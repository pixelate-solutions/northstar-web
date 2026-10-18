import CoreLocation
import MapKit
import Observation

struct RouteLeg: Hashable {
    let from: Int
    let to: Int
    let duration: TimeInterval
    let distance: CLLocationDistance
}

/// Driving directions between consecutive located stops, via Apple Maps. Cached per coordinate pair.
@Observable
@MainActor
final class RouteService {
    static let shared = RouteService()

    private(set) var legs: [String: RouteLeg] = [:]
    private(set) var polylines: [String: MKPolyline] = [:]
    private var inFlight: Set<String> = []

    static func key(_ a: CLLocationCoordinate2D, _ b: CLLocationCoordinate2D) -> String {
        String(format: "%.5f,%.5f>%.5f,%.5f", a.latitude, a.longitude, b.latitude, b.longitude)
    }

    func leg(_ a: CLLocationCoordinate2D, _ b: CLLocationCoordinate2D) -> RouteLeg? { legs[Self.key(a, b)] }
    func polyline(_ a: CLLocationCoordinate2D, _ b: CLLocationCoordinate2D) -> MKPolyline? { polylines[Self.key(a, b)] }

    func ensure(_ points: [(id: Int, coordinate: CLLocationCoordinate2D)]) {
        guard points.count > 1 else { return }
        for i in 0..<(points.count - 1) {
            let a = points[i], b = points[i + 1]
            let key = Self.key(a.coordinate, b.coordinate)
            if legs[key] != nil || inFlight.contains(key) { continue }
            // Skip absurd legs (e.g. a flight home) — MapKit can't drive them anyway.
            if CLLocation(latitude: a.coordinate.latitude, longitude: a.coordinate.longitude)
                .distance(from: CLLocation(latitude: b.coordinate.latitude, longitude: b.coordinate.longitude)) > 1_500_000 { continue }
            inFlight.insert(key)
            Task {
                let request = MKDirections.Request()
                request.source = MKMapItem(placemark: MKPlacemark(coordinate: a.coordinate))
                request.destination = MKMapItem(placemark: MKPlacemark(coordinate: b.coordinate))
                request.transportType = .automobile
                if let route = try? await MKDirections(request: request).calculate().routes.first {
                    legs[key] = RouteLeg(from: a.id, to: b.id, duration: route.expectedTravelTime, distance: route.distance)
                    polylines[key] = route.polyline
                }
                inFlight.remove(key)
            }
        }
    }
}

struct PlaceSuggestion: Identifiable, Hashable {
    let id = UUID()
    let title: String
    let subtitle: String
    let completion: MKLocalSearchCompletion?
}

struct ResolvedPlace {
    let name: String
    let address: String
    let coordinate: CLLocationCoordinate2D
}

/// Apple Maps autocomplete for adding stops.
@Observable
@MainActor
final class PlaceSearch: NSObject, MKLocalSearchCompleterDelegate {
    var query = "" {
        didSet { completer.queryFragment = query.trimmingCharacters(in: .whitespaces) }
    }
    private(set) var suggestions: [PlaceSuggestion] = []
    private let completer = MKLocalSearchCompleter()

    override init() {
        super.init()
        completer.delegate = self
        completer.resultTypes = [.pointOfInterest, .address]
    }

    func bias(to coordinate: CLLocationCoordinate2D?) {
        guard let coordinate else { return }
        completer.region = MKCoordinateRegion(center: coordinate, latitudinalMeters: 60_000, longitudinalMeters: 60_000)
    }

    nonisolated func completerDidUpdateResults(_ completer: MKLocalSearchCompleter) {
        let results = completer.results.prefix(6).map { PlaceSuggestion(title: $0.title, subtitle: $0.subtitle, completion: $0) }
        Task { @MainActor in self.suggestions = Array(results) }
    }

    nonisolated func completer(_ completer: MKLocalSearchCompleter, didFailWithError error: Error) {
        Task { @MainActor in self.suggestions = [] }
    }

    func resolve(_ suggestion: PlaceSuggestion) async -> ResolvedPlace? {
        guard let completion = suggestion.completion else { return nil }
        let response = try? await MKLocalSearch(request: MKLocalSearch.Request(completion: completion)).start()
        guard let item = response?.mapItems.first else { return nil }
        let name = item.name ?? suggestion.title
        let address = suggestion.subtitle.isEmpty ? (item.placemark.title ?? "") : suggestion.subtitle
        return ResolvedPlace(name: name, address: address, coordinate: item.placemark.coordinate)
    }
}

enum CategoryInfo {
    static let all: [(value: String, label: String, symbol: String)] = [
        ("sightseeing", "View", "eye"),
        ("food", "Food", "fork.knife"),
        ("hike", "Hike", "mountain.2"),
        ("accommodation", "Stay", "bed.double"),
        ("drive", "Drive", "car"),
        ("flight", "Flight", "airplane"),
        ("shopping", "Shop", "bag"),
        ("entertainment", "Fun", "ticket"),
        ("other", "Other", "mappin"),
    ]

    static func info(_ value: String) -> (value: String, label: String, symbol: String) {
        all.first { $0.value == value } ?? all[all.count - 1]
    }

    static func guess(_ text: String) -> String {
        let t = text.lowercased()
        let rules: [(String, [String])] = [
            ("food", ["cafe", "café", "coffee", "restaurant", "diner", "grill", "bakery", "pizza", "taco", "bar ", "brewery", "breakfast", "lunch", "dinner"]),
            ("hike", ["trail", "hike", "trailhead", "summit", "peak", "loop"]),
            ("accommodation", ["hotel", "inn", "lodge", "motel", "resort", "airbnb", "cabin", "campground", "hostel", "suites"]),
            ("flight", ["airport", "flight", "terminal"]),
            ("sightseeing", ["point", "overlook", "viewpoint", "vista", "museum", "monument", "park", "arch", "falls", "lake", "beach"]),
            ("shopping", ["shop", "market", "mall", "store", "outlet"]),
        ]
        return rules.first { rule in rule.1.contains { t.contains($0) } }?.0 ?? "other"
    }
}
