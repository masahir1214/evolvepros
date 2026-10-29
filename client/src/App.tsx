import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import DashboardLayout from "./components/DashboardLayout";
import Home from "./pages/Home";
import Search from "./pages/Search";
import Leads from "./pages/Leads";
import Drafts from "./pages/Drafts";
import Integrations from "./pages/Integrations";
import Settings from "./pages/Settings";
import Terms from "./pages/Terms";
import Privacy from "./pages/Privacy";
import ResetPassword from "./pages/ResetPassword";

function Router() {
  return <Switch>
    <Route path="/terms" component={Terms} />
    <Route path="/privacy" component={Privacy} />
    <Route path="/reset-password" component={ResetPassword} />
    <Route>
    <DashboardLayout>
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/search" component={Search} />
      <Route path="/leads" component={Leads} />
      <Route path="/drafts" component={Drafts} />
      <Route path="/integrations" component={Integrations} />
      <Route path="/settings" component={Settings} />
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
    </DashboardLayout>
    </Route>
  </Switch>;
}

function App() {
  return <ErrorBoundary>
    <ThemeProvider defaultTheme="dark">
      <TooltipProvider>
        <Toaster theme="dark" />
        <Router />
      </TooltipProvider>
    </ThemeProvider>
  </ErrorBoundary>;
}

export default App;
