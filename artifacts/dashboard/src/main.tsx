import { createRoot } from "react-dom/client";
import { ClerkProvider, useAuth as useClerkAuth } from "@clerk/clerk-react";
import App from "./App";
import "./index.css";

const publishableKey = import.meta.env["VITE_CLERK_PUBLISHABLE_KEY"];

function ClerkApp() {
	const clerkAuth = useClerkAuth();

	return (
		<App
			clerk={{
				getToken: clerkAuth.getToken,
				isLoaded: clerkAuth.isLoaded,
				isSignedIn: Boolean(clerkAuth.isSignedIn),
				signOut: async () => {
					await clerkAuth.signOut();
				},
			}}
		/>
	);
}

createRoot(document.getElementById("root")!).render(
	publishableKey ? (
		<ClerkProvider publishableKey={publishableKey} afterSignOutUrl="/">
			<ClerkApp />
		</ClerkProvider>
	) : (
		<App />
	)
);
