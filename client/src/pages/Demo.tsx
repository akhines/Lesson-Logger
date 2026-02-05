import { Button } from "@/components/ui/button";
import { ArrowLeft, Play } from "lucide-react";
import { Link, useLocation } from "wouter";
import appLogo from "@assets/Lesson_Logger_1770312446893.PNG";

export default function Demo() {
  const [, setLocation] = useLocation();

  return (
    <div className="min-h-screen bg-background">
      {/* Navbar */}
      <nav className="border-b border-border/50 backdrop-blur-sm fixed w-full z-50 bg-background/80">
        <div className="container mx-auto px-4 h-32 flex items-center justify-between">
          <Link href="/">
            <div className="flex items-center gap-2 cursor-pointer">
              <img 
                src={appLogo} 
                alt="Lesson Logger" 
                className="h-28 w-auto object-contain"
              />
            </div>
          </Link>
          <div className="flex items-center gap-2">
            <Button onClick={() => setLocation("/")} variant="ghost" className="font-semibold" data-testid="button-back-home">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Home
            </Button>
            <Button onClick={() => setLocation("/pricing")} variant="outline" className="font-semibold" data-testid="button-pricing">
              View Pricing
            </Button>
            <Button onClick={() => window.location.href = "/api/login"} variant="default" className="font-semibold" data-testid="button-get-started">
              Get Started
            </Button>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <div className="pt-44 pb-16 px-4">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="text-center mb-12">
            <h1 className="text-4xl md:text-5xl font-display font-bold mb-4">
              See Lesson Logger in Action
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Watch how easy it is to manage your homeschool lessons, track student progress, and build beautiful portfolios.
            </p>
          </div>

          {/* Video Container */}
          <div className="relative aspect-video bg-muted rounded-2xl border border-border overflow-hidden mb-16">
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <div className="h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                  <Play className="h-10 w-10 text-primary ml-1" />
                </div>
                <p className="text-muted-foreground">Video coming soon</p>
              </div>
            </div>
          </div>

          {/* Feature Highlights */}
          <div className="space-y-16">
            <div>
              <h2 className="text-2xl font-display font-bold mb-4">
                Simplify Your Homeschool Planning
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                Lesson Logger takes the stress out of homeschool management. With our intuitive weekly schedule, you can plan lessons for all your students in one place. Drag and drop to rearrange, add subjects with color-coded tags, and see your entire week at a glance. No more scattered papers or complicated spreadsheets.
              </p>
            </div>

            <div>
              <h2 className="text-2xl font-display font-bold mb-4">
                Track Progress Effortlessly
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                Keep all your students organized with individual planners and progress tracking. Students can log into their own portal to see their daily assignments, mark lessons complete, and stay on track. Parents get a clear view of what's been accomplished and what's coming up next.
              </p>
            </div>

            <div>
              <h2 className="text-2xl font-display font-bold mb-4">
                Build Beautiful Portfolios
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                Capture and organize your students' best work with our portfolio system. Upload photos of artwork, writing samples, and completed projects. Review and approve work in your queue, add labels for easy organization, and generate professional PDF portfolios perfect for year-end reviews or sharing with family.
              </p>
            </div>
          </div>

          {/* CTA */}
          <div className="mt-16 text-center">
            <h2 className="text-2xl font-display font-bold mb-4">
              Ready to Get Started?
            </h2>
            <p className="text-muted-foreground mb-8">
              Try Lesson Logger free for 7 days. No credit card required.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button size="lg" onClick={() => setLocation("/pricing")} className="text-lg px-8" data-testid="button-cta-pricing">
                Start Your Free Trial
              </Button>
              <Button size="lg" variant="outline" onClick={() => setLocation("/")} className="text-lg px-8">
                Learn More
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
