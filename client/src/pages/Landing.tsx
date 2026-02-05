import { Button } from "@/components/ui/button";
import { Calendar, BookOpen, CheckCircle, Star, Quote } from "lucide-react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import appLogo from "@assets/Lesson_Logger_1770312446893.PNG";
import dashboardPreview from "@assets/hero-lesson-portfolio.png";
import type { SiteSetting, SiteSection, SiteFeature, SiteFaq, SiteTestimonial, SitePricingPlan } from "@shared/schema";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

const DEFAULT_CONTENT = {
  heroHeadline: "Homeschooling Made Simple",
  heroSubheadline: "Manage lessons, track assignments, and organize your curriculum in one beautiful dashboard. Focus on teaching, not planning.",
  heroPrimaryButton: "Start Your Free Trial",
  heroSecondaryButton: "View Demo",
  featuresHeadline: "Everything you need to succeed",
  featuresSubheadline: "Built specifically for homeschool educators and students to stay on track.",
  feature1Title: "Flexible Scheduling",
  feature1Description: "Drag-and-drop lesson planning that adapts to your life, not the other way around.",
  feature2Title: "Curriculum Tracking",
  feature2Description: "Manage multiple subjects and track progress across the entire school year.",
  feature3Title: "Assignment Management",
  feature3Description: "Create assignments, accept uploads, and grade work all in one place.",
  footerText: "© 2024 Sunwoven Homeschool. All rights reserved.",
};

interface CMSContent {
  sections: SiteSection[];
  features: SiteFeature[];
  pricingPlans: SitePricingPlan[];
  faqs: SiteFaq[];
  testimonials: SiteTestimonial[];
}

function parseFeatures(features: string | null): string[] {
  if (!features) return [];
  try {
    return JSON.parse(features);
  } catch {
    return [];
  }
}

export default function Landing() {
  const [, setLocation] = useLocation();

  const { data: siteSettings } = useQuery<SiteSetting[]>({
    queryKey: ["/api/site-settings/public"],
  });

  const { data: cmsContent } = useQuery<CMSContent>({
    queryKey: ["/api/site/content"],
  });

  const getContent = (key: keyof typeof DEFAULT_CONTENT) => {
    const setting = siteSettings?.find(s => s.key === key);
    return setting?.value || DEFAULT_CONTENT[key];
  };

  const handleLogin = () => {
    window.location.href = "/api/login";
  };

  const activeSections = cmsContent?.sections?.filter(s => s.isEnabled !== false) || [];
  const activeFeatures = cmsContent?.features?.filter(f => f.isEnabled !== false) || [];
  const activeFaqs = cmsContent?.faqs?.filter(f => f.isEnabled !== false) || [];
  const activeTestimonials = cmsContent?.testimonials?.filter(t => t.isEnabled !== false) || [];
  const activePricingPlans = cmsContent?.pricingPlans?.filter(p => p.isEnabled !== false) || [];

  const fallbackFeatures = [
    { 
      icon: Calendar, 
      title: getContent("feature1Title"), 
      desc: getContent("feature1Description"),
      color: "bg-blue-500" 
    },
    { 
      icon: BookOpen, 
      title: getContent("feature2Title"), 
      desc: getContent("feature2Description"),
      color: "bg-amber-500" 
    },
    { 
      icon: CheckCircle, 
      title: getContent("feature3Title"), 
      desc: getContent("feature3Description"),
      color: "bg-emerald-500" 
    },
  ];

  const heroSection = activeSections.find(s => s.sectionType === "hero");
  const featuresSection = activeSections.find(s => s.sectionType === "features");

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Navbar */}
      <nav className="border-b border-border/50 backdrop-blur-sm fixed w-full z-50 bg-background/80">
        <div className="container mx-auto px-4 h-24 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img 
              src={appLogo} 
              alt="Lesson Logger" 
              className="h-20 w-auto object-contain"
            />
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={() => setLocation("/pricing")} variant="ghost" className="font-semibold" data-testid="button-nav-pricing">
              Pricing
            </Button>
            <Button onClick={() => setLocation("/student-login")} variant="outline" className="font-semibold" data-testid="button-student-login">
              Student Login
            </Button>
            <Button onClick={handleLogin} variant="default" className="font-semibold" data-testid="button-parent-login">
              Parent Login
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-36 pb-20 px-4">
        <div className="container mx-auto max-w-6xl">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-6">
              <h1 className="text-5xl md:text-6xl font-display font-bold leading-[1.1] text-foreground">
                {(heroSection?.title || getContent("heroHeadline")).split(" ").slice(0, -2).join(" ")} <br/>
                <span className="text-primary">{(heroSection?.title || getContent("heroHeadline")).split(" ").slice(-2).join(" ")}</span>
              </h1>
              <p className="text-xl text-muted-foreground leading-relaxed max-w-lg">
                {heroSection?.subtitle || getContent("heroSubheadline")}
              </p>
              <div className="flex flex-col sm:flex-row gap-4 pt-4">
                <Button size="lg" onClick={() => setLocation("/pricing")} className="text-lg px-8 h-12 shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 transition-all" data-testid="button-get-started">
                  {getContent("heroPrimaryButton")}
                </Button>
                <Button size="lg" variant="outline" className="text-lg px-8 h-12">
                  {getContent("heroSecondaryButton")}
                </Button>
              </div>
              <p className="text-sm text-muted-foreground">
                Try free for 7 days. No credit card required.
              </p>
            </div>
            <div className="relative">
              <div className="absolute -inset-4 bg-gradient-to-r from-primary/20 to-secondary/20 rounded-full blur-3xl opacity-50 animate-pulse" />
              
              <div className="relative rounded-2xl shadow-2xl border border-border overflow-hidden transform rotate-1 hover:rotate-0 transition-transform duration-500">
                <img 
                  src={dashboardPreview} 
                  alt="Sunwoven Homeschool Dashboard Preview" 
                  className="w-full h-auto"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-24 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <h2 className="text-3xl font-display font-bold mb-4">
              {featuresSection?.title || getContent("featuresHeadline")}
            </h2>
            <p className="text-muted-foreground">
              {featuresSection?.subtitle || getContent("featuresSubheadline")}
            </p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8">
            {activeFeatures.length > 0 ? (
              activeFeatures.map((feature) => (
                <div key={feature.id} className="bg-card p-8 rounded-2xl border border-border hover:shadow-lg transition-all duration-300 group">
                  <div className="h-12 w-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                    {feature.icon === "Calendar" && <Calendar className="h-6 w-6" />}
                    {feature.icon === "BookOpen" && <BookOpen className="h-6 w-6" />}
                    {feature.icon === "CheckCircle" && <CheckCircle className="h-6 w-6" />}
                    {!feature.icon && <Star className="h-6 w-6" />}
                  </div>
                  <h3 className="text-xl font-bold mb-3">{feature.title}</h3>
                  <p className="text-muted-foreground leading-relaxed">{feature.description}</p>
                </div>
              ))
            ) : (
              fallbackFeatures.map((feature, i) => (
                <div key={i} className="bg-card p-8 rounded-2xl border border-border hover:shadow-lg transition-all duration-300 group">
                  <div className="h-12 w-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                    <feature.icon className="h-6 w-6" />
                  </div>
                  <h3 className="text-xl font-bold mb-3">{feature.title}</h3>
                  <p className="text-muted-foreground leading-relaxed">{feature.desc}</p>
                </div>
              ))
            )}
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      {activeTestimonials.length > 0 && (
        <section className="py-24">
          <div className="container mx-auto px-4">
            <div className="text-center max-w-2xl mx-auto mb-16">
              <h2 className="text-3xl font-display font-bold mb-4">
                What Parents Are Saying
              </h2>
              <p className="text-muted-foreground">
                Hear from homeschool families who use Sunwoven every day
              </p>
            </div>
            
            <div className="grid md:grid-cols-3 gap-8">
              {activeTestimonials.slice(0, 3).map((testimonial) => (
                <Card key={testimonial.id} className="border-border">
                  <CardHeader>
                    <div className="flex items-center gap-1 mb-2">
                      {[...Array(testimonial.rating || 5)].map((_, i) => (
                        <Star key={i} className="h-4 w-4 fill-primary text-primary" />
                      ))}
                    </div>
                    <Quote className="h-8 w-8 text-primary/20" />
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground italic leading-relaxed">
                      "{testimonial.content}"
                    </p>
                  </CardContent>
                  <CardFooter>
                    <div>
                      <p className="font-semibold">{testimonial.name}</p>
                      {testimonial.role && (
                        <p className="text-sm text-muted-foreground">{testimonial.role}</p>
                      )}
                    </div>
                  </CardFooter>
                </Card>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Pricing Section */}
      {activePricingPlans.length > 0 && (
        <section className="py-24 bg-muted/30">
          <div className="container mx-auto px-4">
            <div className="text-center max-w-2xl mx-auto mb-16">
              <h2 className="text-3xl font-display font-bold mb-4">
                Simple, Transparent Pricing
              </h2>
              <p className="text-muted-foreground">
                Start with a free trial, then choose the plan that works for your family
              </p>
            </div>
            
            <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
              {activePricingPlans.map((plan) => (
                <Card key={plan.id} className={`border-border ${plan.isPopular ? "border-primary ring-2 ring-primary/20" : ""}`}>
                  <CardHeader>
                    {plan.isPopular && (
                      <span className="px-3 py-1 text-xs font-semibold bg-primary text-primary-foreground rounded-full w-fit mb-2">
                        Most Popular
                      </span>
                    )}
                    <CardTitle className="text-xl">{plan.name}</CardTitle>
                    <CardDescription>{plan.description}</CardDescription>
                    <div className="pt-4">
                      <span className="text-4xl font-bold">{plan.price}</span>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-3">
                      {parseFeatures(plan.features).map((feature, i) => (
                        <li key={i} className="flex items-center gap-2">
                          <CheckCircle className="h-4 w-4 text-primary flex-shrink-0" />
                          <span className="text-sm text-muted-foreground">{feature}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                  <CardFooter>
                    <Button 
                      className="w-full" 
                      variant={plan.isPopular ? "default" : "outline"}
                      onClick={() => setLocation("/pricing")}
                      data-testid={`button-select-plan-${plan.id}`}
                    >
                      Get Started
                    </Button>
                  </CardFooter>
                </Card>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* FAQ Section */}
      {activeFaqs.length > 0 && (
        <section className="py-24">
          <div className="container mx-auto px-4">
            <div className="text-center max-w-2xl mx-auto mb-16">
              <h2 className="text-3xl font-display font-bold mb-4">
                Frequently Asked Questions
              </h2>
              <p className="text-muted-foreground">
                Find answers to common questions about Sunwoven Homeschool
              </p>
            </div>
            
            <div className="max-w-2xl mx-auto">
              <Accordion type="single" collapsible className="w-full">
                {activeFaqs.map((faq) => (
                  <AccordionItem key={faq.id} value={`faq-${faq.id}`}>
                    <AccordionTrigger className="text-left font-semibold">
                      {faq.question}
                    </AccordionTrigger>
                    <AccordionContent className="text-muted-foreground leading-relaxed">
                      {faq.answer}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </div>
          </div>
        </section>
      )}

      {/* CTA Section */}
      <section className="py-24 bg-primary/5">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl md:text-4xl font-display font-bold mb-4">
            Ready to simplify your homeschool?
          </h2>
          <p className="text-muted-foreground mb-8 max-w-xl mx-auto">
            Join thousands of homeschool families using Sunwoven to organize lessons, track progress, and make learning enjoyable.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" onClick={() => setLocation("/pricing")} className="text-lg px-8" data-testid="button-cta-get-started">
              Start Your Free Trial
            </Button>
            <Button size="lg" variant="outline" onClick={handleLogin} className="text-lg px-8">
              Sign In
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 border-t border-border mt-auto">
        <div className="container mx-auto px-4 text-center text-muted-foreground">
          <p>{getContent("footerText")}</p>
        </div>
      </footer>
    </div>
  );
}
