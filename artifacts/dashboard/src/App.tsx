import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/hooks/use-auth";
import { Layout } from "@/components/layout";
import NotFound from "@/pages/not-found";

// Pages
import Login from "@/pages/login";
import Signup from "@/pages/signup";
import Settings from "@/pages/settings";
import Conversations from "@/pages/conversations";
import Install from "@/pages/install";
import ApiKeys from "@/pages/api-keys";

const queryClient = new QueryClient();

function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  const { isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return <Login />;
  }

  return (
    <Layout>
      <Component />
    </Layout>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={Login} />
      <Route path="/signup" component={Signup} />
      <Route path="/settings">
        <ProtectedRoute component={Settings} />
      </Route>
      <Route path="/conversations">
        <ProtectedRoute component={Conversations} />
      </Route>
      <Route path="/install">
        <ProtectedRoute component={Install} />
      </Route>
      <Route path="/api-keys">
        <ProtectedRoute component={ApiKeys} />
      </Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <AuthProvider>
            <Router />
          </AuthProvider>
        </WouterRouter>
        <Toaster richColors duration={8000} />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
