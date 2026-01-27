import time
from playwright.sync_api import sync_playwright

def verify_web_ui():
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page()

        try:
            print("Navigating to http://localhost:8000...")
            page.goto("http://localhost:8000")

            # Verify title
            title = page.title()
            print(f"Page title: {title}")
            assert "AI Writing Agent Platform" in title

            # Verify sidebar
            print("Checking sidebar...")
            page.wait_for_selector(".sidebar")

            # Verify chat area
            print("Checking chat area...")
            page.wait_for_selector(".chat-area")

            # Verify input area
            print("Checking input area...")
            page.wait_for_selector("#user-input")

            # Verify tabs
            print("Checking tabs...")
            page.wait_for_selector(".tab-btn")

            # Wait for WebSocket connection message (optional)
            time.sleep(2)

            # Take screenshot
            screenshot_path = "verification_screenshot.png"
            page.screenshot(path=screenshot_path)
            print(f"Screenshot saved to {screenshot_path}")

        except Exception as e:
            print(f"Verification failed: {e}")
            raise e
        finally:
            browser.close()

if __name__ == "__main__":
    verify_web_ui()
