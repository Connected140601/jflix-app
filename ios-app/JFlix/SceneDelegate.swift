import UIKit

class SceneDelegate: UIResponder, UIWindowSceneDelegate {

    var window: UIWindow?

    func scene(
        _ scene: UIScene,
        willConnectTo session: UISceneSession,
        options connectionOptions: UIScene.ConnectionOptions
    ) {
        guard let windowScene = (scene as? UIWindowScene) else { return }
        let window = UIWindow(windowScene: windowScene)
        window.rootViewController = ViewController()
        window.backgroundColor = .black
        window.makeKeyAndVisible()
        self.window = window

        // Deep link into the site (jflix.uk / jflixuk.pages.dev Universal Links
        // route here when the associated-domains entitlement is configured).
        if let urlContext = connectionOptions.urlContexts.first {
            self.handleIncomingURL(urlContext.url)
        }
    }

    func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
        if let url = URLContexts.first?.url {
            self.handleIncomingURL(url)
        }
    }

    private func handleIncomingURL(_ url: URL) {
        // Hand deep links to the web app (player links, password resets, ...).
        guard let root = self.window?.rootViewController as? ViewController else { return }
        root.loadDeepLink(url)
    }
}
