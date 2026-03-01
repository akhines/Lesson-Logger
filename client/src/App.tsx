import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/use-auth";
import { ImpersonationBanner } from "@/components/ImpersonationBanner";
import { Suspense, lazy } from "react";
import { Loader2 } from "lucide-react";

const Landing = lazy(() => import("@/pages/Landing"));
const Dashboard = lazy(() => import("@/pages/Dashboard"));
const Subjects = lazy(() => import("@/pages/Subjects"));
const Schedule = lazy(() => import("@/pages/Schedule"));
const Students = lazy(() => import("@/pages/Students"));
const StudentLogin = lazy(() => import("@/pages/StudentLogin"));
const StudentPortal = lazy(() => import("@/pages/StudentPortal"));
const StudentMathFacts = lazy(() => import("@/pages/StudentMathFacts"));
const StudentWriting = lazy(() => import("@/pages/StudentWriting"));
const StudentArtStudio = lazy(() => import("@/pages/StudentArtStudio"));
const StudentGrammarPractice = lazy(() => import("@/pages/StudentGrammarPractice"));
const StudentLibrary = lazy(() => import("@/pages/StudentLibrary"));
const StudentBookReader = lazy(() => import("@/pages/StudentBookReader"));
const StudentHelper = lazy(() => import("@/pages/StudentHelper"));
const GrammarPractice = lazy(() => import("@/pages/GrammarPractice"));
const Wizard = lazy(() => import("@/pages/Wizard"));
const CopyworkCreator = lazy(() => import("@/pages/CopyworkCreator"));
const CurriculumLibrary = lazy(() => import("@/pages/CurriculumLibrary"));
const MathFacts = lazy(() => import("@/pages/MathFacts"));
const Reports = lazy(() => import("@/pages/Reports"));
const AdminSettings = lazy(() => import("@/pages/AdminSettings"));
const SubjectDetail = lazy(() => import("@/pages/SubjectDetail"));
const Library = lazy(() => import("@/pages/Library"));
const BookReader = lazy(() => import("@/pages/BookReader"));
const Portfolio = lazy(() => import("@/pages/Portfolio"));
const QRUpload = lazy(() => import("@/pages/QRUpload"));
const Pricing = lazy(() => import("@/pages/Pricing"));
const Demo = lazy(() => import("@/pages/Demo"));
const HomepageBuilder = lazy(() => import("@/pages/HomepageBuilder"));
const PublicPortfolio = lazy(() => import("@/pages/PublicPortfolio"));
const ManageShareLinks = lazy(() => import("@/pages/ManageShareLinks"));
const Organizations = lazy(() => import("@/pages/Organizations"));
const LessonLogging = lazy(() => import("@/pages/LessonLogging"));
const Onboarding = lazy(() => import("@/pages/Onboarding"));
const ReminderSettings = lazy(() => import("@/pages/ReminderSettings"));
const UploadStation = lazy(() => import("@/pages/UploadStation"));
const NotFound = lazy(() => import("@/pages/not-found"));

function PageLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );
}

function Router() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return <PageLoader />;
  }

  return (
    <Suspense fallback={<PageLoader />}>
      <Switch>
        <Route path="/upload/:token" component={QRUpload} />
        <Route path="/pricing" component={Pricing} />
        <Route path="/demo" component={Demo} />
        <Route path="/portfolio/:token" component={PublicPortfolio} />

        <Route path="/student-login" component={StudentLogin} />
        <Route path="/student-portal" component={StudentPortal} />
        <Route path="/student-math-facts" component={StudentMathFacts} />
        <Route path="/student-grammar" component={StudentGrammarPractice} />
        <Route path="/student-writing" component={StudentWriting} />
        <Route path="/student-art" component={StudentArtStudio} />
        <Route path="/student-library" component={StudentLibrary} />
        <Route path="/student-book-reader" component={StudentBookReader} />
        <Route path="/student-helper" component={StudentHelper} />

        {!user ? (
          <>
            <Route path="/" component={Landing} />
            <Route component={() => {
               window.location.href = "/";
               return null;
            }} />
          </>
        ) : (
          <>
            <Route path="/" component={Dashboard} />
            <Route path="/students" component={Students} />
            <Route path="/subjects" component={Subjects} />
            <Route path="/subjects/:id" component={SubjectDetail} />
            <Route path="/schedule" component={Schedule} />
            <Route path="/wizard" component={Wizard} />
            <Route path="/copywork" component={CopyworkCreator} />
            <Route path="/curriculum-library" component={CurriculumLibrary} />
            <Route path="/math-facts" component={MathFacts} />
            <Route path="/grammar-practice" component={GrammarPractice} />
            <Route path="/reports" component={Reports} />
            <Route path="/library" component={Library} />
            <Route path="/library/read/:id" component={BookReader} />
            <Route path="/lesson-logging" component={LessonLogging} />
            <Route path="/onboarding" component={Onboarding} />
            <Route path="/reminders" component={ReminderSettings} />
            <Route path="/upload-station" component={UploadStation} />
            <Route path="/portfolio" component={Portfolio} />
            <Route path="/manage-share-links" component={ManageShareLinks} />
            <Route path="/organizations" component={Organizations} />
            <Route path="/settings" component={AdminSettings} />
            <Route path="/homepage-builder" component={HomepageBuilder} />
            <Route component={NotFound} />
          </>
        )}
      </Switch>
    </Suspense>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <ImpersonationBanner />
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
