import XCTest

/// End-to-end UI tests against the API in the build config (Debug = local dev server).
/// Pass the Clerk test user's password with TEST_RUNNER_E2E_PASSWORD=… on the xcodebuild command line.
final class NorthstarUITests: XCTestCase {
    var app: XCUIApplication!

    override func setUp() {
        continueAfterFailure = false
        app = XCUIApplication()
        app.launch()
    }

    private func element(_ id: String) -> XCUIElement { app.descendants(matching: .any)[id] }

    private func signInIfNeeded() {
        let trips = app.buttons["Trips"]
        if trips.waitForExistence(timeout: 6) { return }
        app.buttons["Get started"].tap()
        let identifier = app.textFields.matching(identifier: "clerk.auth.start.identifier").firstMatch
        XCTAssertTrue(identifier.waitForExistence(timeout: 15))
        // Clerk restores the last identifier; select all and type over it.
        identifier.tap()
        if let existing = identifier.value as? String, !existing.isEmpty, !existing.hasPrefix("Enter your") {
            identifier.press(forDuration: 1.2)
            let selectAll = app.menuItems["Select All"]
            if selectAll.waitForExistence(timeout: 3) { selectAll.tap() }
            app.typeText(XCUIKeyboardKey.delete.rawValue)
        }
        app.typeText(ProcessInfo.processInfo.environment["E2E_USERNAME"] ?? "northstar_e2e")
        app.buttons["clerk.auth.start.continue"].tap()

        let password = app.secureTextFields.matching(identifier: "clerk.auth.signIn.password").firstMatch
        XCTAssertTrue(password.waitForExistence(timeout: 15))
        password.tap()
        app.typeText(ProcessInfo.processInfo.environment["E2E_PASSWORD"] ?? "")
        app.buttons["clerk.auth.signIn.continue"].tap()

        // New-device verification for +clerk_test addresses accepts Clerk's fixed test code.
        if !trips.waitForExistence(timeout: 8) {
            let code = app.textFields.firstMatch
            if code.waitForExistence(timeout: 10) {
                code.tap()
                app.typeText("424242")
            }
        }
        XCTAssertTrue(trips.waitForExistence(timeout: 30), "Plan screen should load after sign-in")
    }

    func testPlanListsBudgetAndAsk() throws {
        signInIfNeeded()
        attach("plan-trip")

        // Open day 2 from the day strip.
        let day2 = app.buttons["Day 2"]
        XCTAssertTrue(day2.waitForExistence(timeout: 10))
        day2.tap()
        XCTAssertTrue(app.staticTexts.matching(NSPredicate(format: "label BEGINSWITH 'DAY 2'")).firstMatch.waitForExistence(timeout: 10))
        sleep(3)
        attach("plan-day")

        // The drawer drags up to full height and back down.
        let handle = element("drawer-handle")
        XCTAssertTrue(handle.waitForExistence(timeout: 5))
        handle.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.2))
            .press(forDuration: 0.05, thenDragTo: app.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.05)))
        sleep(1)
        attach("drawer-full")
        XCTAssertLessThan(handle.frame.minY, app.frame.height * 0.2, "Drawer should snap to full height")

        // Tapping a leg focuses that route on the map.
        let leg = app.descendants(matching: .any).matching(NSPredicate(format: "label BEGINSWITH 'Route '")).element(boundBy: 1)
        if leg.waitForExistence(timeout: 8) {
            leg.tap()
            sleep(2)
            attach("leg-focus")
        }

        // Add a stop through the Apple Maps search sheet.
        let name = "iOS E2E \(Int(Date().timeIntervalSince1970) % 100000)"
        let addStop = app.buttons["Add a stop"]
        for _ in 0..<8 where !addStop.isHittable {
            app.swipeUp(velocity: .slow)
        }
        addStop.tap()
        let search = app.searchFields.firstMatch
        XCTAssertTrue(search.waitForExistence(timeout: 10))
        search.tap()
        app.typeText(name)
        let addPlain = app.buttons.matching(NSPredicate(format: "label CONTAINS %@", name)).firstMatch
        XCTAssertTrue(addPlain.waitForExistence(timeout: 10))
        addPlain.tap()
        let row = app.staticTexts[name]
        XCTAssertTrue(row.waitForExistence(timeout: 15), "New stop should appear in the day")

        // Edit it, then delete it.
        row.tap()
        let done = app.buttons["Done"]
        XCTAssertTrue(done.waitForExistence(timeout: 10))
        attach("stop-editor")
        XCTAssertFalse(app.textViews["Details"].exists || app.textFields["Details"].exists, "Only one notes field")
        app.buttons["Mark booked"].tap()
        XCTAssertTrue(app.buttons["Booked"].waitForExistence(timeout: 5))
        done.tap()
        sleep(1)
        XCTAssertFalse(app.buttons["Reorder"].exists, "Reorder button is gone; rows reorder by dragging")
        scrollAboveTabBar(row)
        row.swipeLeft()
        app.buttons["Delete"].firstMatch.tap()
        confirmDelete()
        XCTAssertTrue(row.waitForNonExistence(timeout: 10))

        // Lists: add and check off a to-do.
        app.tabBars.buttons["Lists"].tap()
        let addTodo = app.textFields["Add a to-do"]
        XCTAssertTrue(addTodo.waitForExistence(timeout: 10))
        let todo = "iOS todo \(Int(Date().timeIntervalSince1970) % 100000)"
        addTodo.tap()
        app.typeText(todo + "\n")
        let check = app.buttons[todo]
        XCTAssertTrue(reveal(check), "New to-do should be in the list")
        check.tap()
        attach("lists")
        scrollAboveTabBar(app.staticTexts[todo])
        app.staticTexts[todo].swipeLeft()
        app.buttons["Delete"].firstMatch.tap()
        confirmDelete()
        XCTAssertTrue(app.staticTexts[todo].waitForNonExistence(timeout: 10))

        // Budget renders the total.
        app.tabBars.buttons["Budget"].tap()
        XCTAssertTrue(app.staticTexts["TRIP TOTAL"].waitForExistence(timeout: 10))
        attach("budget")

        // Ask is a real tab: tab bar stays, no close button, no keyboard on arrival.
        app.tabBars.buttons["Ask"].tap()
        XCTAssertTrue(app.staticTexts["What should we change?"].waitForExistence(timeout: 10))
        XCTAssertTrue(app.tabBars.firstMatch.isHittable)
        XCTAssertFalse(app.buttons["Close"].exists)
        XCTAssertFalse(app.keyboards.firstMatch.exists, "Keyboard shouldn't pop up on its own")
        attach("ask")
        app.buttons["Chats"].tap()
        XCTAssertTrue(element("chat-history").waitForExistence(timeout: 5))
        XCTAssertTrue(app.buttons["New chat"].firstMatch.exists)
        attach("ask-history")
        app.buttons["New chat"].firstMatch.tap()
        XCTAssertTrue(element("chat-history").waitForNonExistence(timeout: 5))

        // Preferences live in the account sheet.
        app.tabBars.buttons["Plan"].tap()
        app.buttons["Account"].tap()
        let clock24 = app.switches["24-hour time"]
        XCTAssertTrue(clock24.waitForExistence(timeout: 5))
        XCTAssertTrue(app.switches["Move checked items to bottom"].exists)
        attach("account")
        app.swipeDown(velocity: .fast)

        // Deleting a trip needs its name typed.
        app.buttons["Trips"].tap()
        let deleteTrip = app.buttons["Delete trip"]
        if deleteTrip.waitForExistence(timeout: 3) {
            deleteTrip.tap()
            XCTAssertTrue(element("delete-trip-name").waitForExistence(timeout: 5))
            XCTAssertFalse(app.buttons.matching(identifier: "Delete trip").firstMatch.isEnabled)
            attach("delete-trip")
            app.buttons["Cancel"].tap()
        } else {
            app.tap()
        }
    }

    /// Lists render lazily; scroll down until the row exists.
    private func reveal(_ element: XCUIElement) -> Bool {
        if element.waitForExistence(timeout: 4) { return true }
        for _ in 0..<12 {
            app.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.75))
                .press(forDuration: 0.05, thenDragTo: app.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.3)))
            if element.waitForExistence(timeout: 1) { return true }
        }
        return false
    }

    /// Rows can scroll under the floating tab bar; a swipe there would switch tabs.
    private func scrollAboveTabBar(_ element: XCUIElement) {
        let barTop = app.tabBars.firstMatch.frame.minY
        for _ in 0..<6 where element.frame.maxY > barTop - 20 {
            app.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.7))
                .press(forDuration: 0.05, thenDragTo: app.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.45)))
        }
    }

    private func confirmDelete() {
        // Swipe action first, then the "Are you sure?" dialog.
        let buttons = app.buttons.matching(identifier: "Delete")
        let deadline = Date().addingTimeInterval(5)
        while buttons.count < 1 && Date() < deadline { usleep(200_000) }
        sleep(1)
        attach("confirm-delete")
        buttons.element(boundBy: buttons.count - 1).tap()
    }

    /// Save for offline, relaunch with no connection, edit and ask, then reconnect and check the edit synced.
    func testOfflineMode() throws {
        signInIfNeeded()
        app.buttons["Account"].tap()
        let offline = app.switches["Offline mode"]
        XCTAssertTrue(offline.waitForExistence(timeout: 5))
        if (offline.value as? String) != "1" { offline.switches.firstMatch.tap() }
        sleep(2)
        attach("offline-progress")
        XCTAssertTrue(app.staticTexts["Ready offline"].waitForExistence(timeout: 600), "Offline download should finish")
        attach("offline-ready")

        // No connection.
        app.terminate()
        app.launchArguments = ["-NorthstarForceOffline", "YES"]
        app.launch()
        XCTAssertTrue(app.buttons["Trips"].waitForExistence(timeout: 20), "Saved trip should open offline")
        XCTAssertTrue(element("offline-pill").waitForExistence(timeout: 10))
        app.buttons["Day 2"].tap()
        sleep(2)
        attach("offline-plan")

        // Edits work offline and are queued.
        app.tabBars.buttons["Lists"].tap()
        let todo = "Offline todo \(Int(Date().timeIntervalSince1970) % 100000)"
        let addTodo = app.textFields["Add a to-do"]
        XCTAssertTrue(addTodo.waitForExistence(timeout: 10))
        addTodo.tap()
        app.typeText(todo + "\n")
        XCTAssertTrue(reveal(app.staticTexts[todo]))
        attach("offline-lists")

        // Ask offers the on-device assistant.
        app.tabBars.buttons["Ask"].tap()
        let input = app.textFields["Ask Northstar"]
        XCTAssertTrue(input.waitForExistence(timeout: 10))
        input.tap()
        app.typeText("What's on Day 2?")
        app.buttons["ask-send"].tap()
        let offer = app.alerts["You're offline"]
        if offer.waitForExistence(timeout: 10) {
            attach("offline-ai-offer")
            offer.buttons["Use offline assistant"].tap()
            // The Simulator lacks Apple's on-device safety model, so generation fails there; real devices answer.
            let answered = app.staticTexts["On-device"].waitForExistence(timeout: 120)
            sleep(2)
            attach(answered ? "offline-ai-answer" : "offline-ai-simulator-error")
            if !answered {
                let alert = app.alerts.firstMatch
                XCTAssertTrue(alert.staticTexts.allElementsBoundByIndex.contains { $0.label.contains("offline assistant") })
                alert.buttons["OK"].tap()
            }
        } else {
            attach("offline-ai-unavailable")
        }

        // Back online: the queued to-do reaches the server.
        app.terminate()
        app.launchArguments = []
        app.launch()
        XCTAssertTrue(app.buttons["Trips"].waitForExistence(timeout: 20))
        XCTAssertTrue(element("offline-pill").waitForNonExistence(timeout: 20), "Should sync and go back online")
        app.terminate()
        app.launch() // Fresh load straight from the server.
        app.tabBars.buttons["Lists"].tap()
        let synced = app.staticTexts[todo]
        XCTAssertTrue(app.textFields["Add a to-do"].waitForExistence(timeout: 15))
        XCTAssertTrue(reveal(synced), "Offline to-do should be on the server")
        attach("offline-synced")
        scrollAboveTabBar(synced)
        synced.swipeLeft()
        app.buttons["Delete"].firstMatch.tap()
        confirmDelete()
        XCTAssertTrue(synced.waitForNonExistence(timeout: 10))
    }

    func testDrawerDrag() throws {
        signInIfNeeded()
        app.buttons["Day 2"].tap()
        sleep(3)
        let handle = element("drawer-handle")
        XCTAssertTrue(handle.waitForExistence(timeout: 5))
        func drag(to y: CGFloat) {
            handle.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.15))
                .press(forDuration: 0.1, thenDragTo: app.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: y)), withVelocity: XCUIGestureVelocity(150), thenHoldForDuration: 0.3)
            sleep(1)
        }
        let start = handle.frame.minY
        drag(to: 0.08)
        attach("drawer-up")
        XCTAssertLessThan(handle.frame.minY, start - 200)
        drag(to: 0.92)
        attach("drawer-down")
        XCTAssertGreaterThan(handle.frame.minY, app.frame.height * 0.75)
        drag(to: 0.48)
        attach("drawer-half")
        XCTAssertEqual(handle.frame.minY, start, accuracy: 40)
    }

    /// The drawer's white surface must reach the bottom of the screen at full height (no map under the tab bar),
    /// and the low position must sit above the tab bar.
    func testDrawerCoversScreenAtEveryHeight() throws {
        signInIfNeeded()
        app.buttons["Day 2"].tap()
        sleep(3)
        let handle = element("drawer-handle")
        XCTAssertTrue(handle.waitForExistence(timeout: 5))
        func drag(to y: CGFloat) {
            handle.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.15))
                .press(forDuration: 0.1, thenDragTo: app.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: y)))
            sleep(2)
        }

        drag(to: 0.05)
        let shot = app.screenshot()
        attach("drawer-full-bottom")
        // Left edge beside the floating tab bar, just above the home indicator: must be the white drawer, not map.
        let image = shot.image
        for fy in [0.93, 0.97, 0.99] as [CGFloat] {
            let color = pixel(image, x: image.size.width * 0.02, y: image.size.height * fy)
            XCTAssertGreaterThan(min(color.r, color.g, color.b), 0.93, "Map shows under the tab bar at y=\(fy)")
        }

        drag(to: 0.95)
        attach("drawer-low")
        XCTAssertLessThan(handle.frame.maxY, app.tabBars.firstMatch.frame.minY + 4, "Low drawer should sit above the tab bar")

        drag(to: 0.5)
        XCTAssertTrue(app.staticTexts.matching(NSPredicate(format: "label BEGINSWITH 'DAY 2'")).firstMatch.isHittable)
    }

    private func pixel(_ image: UIImage, x: CGFloat, y: CGFloat) -> (r: CGFloat, g: CGFloat, b: CGFloat) {
        guard let cg = image.cgImage else { return (0, 0, 0) }
        let scale = CGFloat(cg.width) / image.size.width
        var data = [UInt8](repeating: 0, count: 4)
        let context = CGContext(data: &data, width: 1, height: 1, bitsPerComponent: 8, bytesPerRow: 4, space: CGColorSpaceCreateDeviceRGB(), bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue)!
        context.draw(cg, in: CGRect(x: -x * scale, y: -(CGFloat(cg.height) - y * scale), width: CGFloat(cg.width), height: CGFloat(cg.height)))
        return (CGFloat(data[0]) / 255, CGFloat(data[1]) / 255, CGFloat(data[2]) / 255)
    }

    func testEditProfileName() throws {
        signInIfNeeded()
        func rename(to last: String) {
            app.buttons["Account"].tap()
            let edit = element("edit-profile")
            XCTAssertTrue(edit.waitForExistence(timeout: 5))
            edit.tap()
            let field = app.textFields["Last name"]
            XCTAssertTrue(field.waitForExistence(timeout: 5))
            field.tap()
            field.press(forDuration: 1.0)
            if app.menuItems["Select All"].waitForExistence(timeout: 2) { app.menuItems["Select All"].tap() }
            app.typeText(XCUIKeyboardKey.delete.rawValue + last)
            attach("profile-edit-\(last)")
            app.buttons["Save"].tap()
            XCTAssertTrue(app.staticTexts.matching(NSPredicate(format: "label ENDSWITH %@", last)).firstMatch.waitForExistence(timeout: 15), "Account sheet should show the new name")
            attach("profile-saved-\(last)")
            app.swipeDown(velocity: .fast)
            sleep(1)
        }
        rename(to: "QA")
        rename(to: "Tester")
    }

    private func attach(_ name: String) {
        let shot = XCTAttachment(screenshot: app.screenshot())
        shot.name = name
        shot.lifetime = .keepAlways
        add(shot)
    }
}
