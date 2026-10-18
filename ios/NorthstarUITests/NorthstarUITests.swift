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
        app.buttons["Not booked"].tap()
        XCTAssertTrue(app.buttons["Booked"].waitForExistence(timeout: 5))
        done.tap()
        sleep(1)
        row.swipeLeft()
        app.buttons["Delete"].firstMatch.tap()
        XCTAssertTrue(row.waitForNonExistence(timeout: 10))

        // Lists: add and check off a to-do.
        app.tabBars.buttons["Lists"].tap()
        let addTodo = app.textFields["Add a to-do"]
        XCTAssertTrue(addTodo.waitForExistence(timeout: 10))
        let todo = "iOS todo \(Int(Date().timeIntervalSince1970) % 100000)"
        addTodo.tap()
        app.typeText(todo + "\n")
        let check = app.buttons[todo]
        XCTAssertTrue(check.waitForExistence(timeout: 10))
        check.tap()
        attach("lists")
        app.staticTexts[todo].swipeLeft()
        app.buttons["Delete"].firstMatch.tap()

        // Budget renders the total.
        app.tabBars.buttons["Budget"].tap()
        XCTAssertTrue(app.staticTexts["TRIP TOTAL"].waitForExistence(timeout: 10))
        attach("budget")

        // Ask opens full screen and closes.
        app.tabBars.buttons["Ask"].tap()
        XCTAssertTrue(app.staticTexts["What should we change?"].waitForExistence(timeout: 10))
        attach("ask")
        app.buttons["Close"].tap()
    }

    private func attach(_ name: String) {
        let shot = XCTAttachment(screenshot: app.screenshot())
        shot.name = name
        shot.lifetime = .keepAlways
        add(shot)
    }
}
