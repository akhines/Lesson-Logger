import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  GripVertical,
  Plus,
  Pencil,
  Trash2,
  Eye,
  EyeOff,
  Save,
  Loader2,
  LayoutDashboard,
  Star,
  DollarSign,
  HelpCircle,
  MessageSquareQuote,
} from "lucide-react";
import type { SiteSection, SiteFeature, SitePricingPlan, SiteFaq, SiteTestimonial } from "@shared/schema";

interface SortableItemProps {
  id: number;
  children: React.ReactNode;
}

function SortableItem({ id, children }: SortableItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="flex items-start gap-2">
      <button
        {...attributes}
        {...listeners}
        className="mt-3 cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground"
        data-testid={`drag-handle-${id}`}
      >
        <GripVertical className="h-5 w-5" />
      </button>
      <div className="flex-1">{children}</div>
    </div>
  );
}

function SectionEditor({ section, onSave, onDelete }: {
  section: SiteSection;
  onSave: (updates: Partial<SiteSection>) => void;
  onDelete: () => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [title, setTitle] = useState(section.title || "");
  const [subtitle, setSubtitle] = useState(section.subtitle || "");
  const [content, setContent] = useState(section.content || "");

  const handleSave = () => {
    onSave({
      title: title || null,
      subtitle: subtitle || null,
      content: content || null,
    });
    setIsEditing(false);
  };

  const isEnabled = section.isEnabled !== false;

  return (
    <Card className={`${!isEnabled ? "opacity-60" : ""}`}>
      <CardHeader className="flex flex-row items-center justify-between gap-4 pb-2">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 text-xs font-medium rounded bg-primary/10 text-primary">
              {section.sectionType}
            </span>
            <CardTitle className="text-base">{section.title || "Untitled"}</CardTitle>
          </div>
          {section.subtitle && (
            <CardDescription className="mt-1">{section.subtitle}</CardDescription>
          )}
        </div>
        <div className="flex items-center gap-1">
          <Button
            size="icon"
            variant="ghost"
            onClick={() => onSave({ isEnabled: !isEnabled })}
            data-testid={`toggle-section-${section.id}`}
          >
            {isEnabled ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
          </Button>
          <Dialog open={isEditing} onOpenChange={setIsEditing}>
            <DialogTrigger asChild>
              <Button size="icon" variant="ghost" data-testid={`edit-section-${section.id}`}>
                <Pencil className="h-4 w-4" />
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Edit {section.sectionType} Section</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Title</Label>
                  <Input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    data-testid="section-title-input"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Subtitle</Label>
                  <Input
                    value={subtitle}
                    onChange={(e) => setSubtitle(e.target.value)}
                    data-testid="section-subtitle-input"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Content</Label>
                  <Textarea
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    rows={4}
                    data-testid="section-content-input"
                  />
                </div>
              </div>
              <DialogFooter>
                <DialogClose asChild>
                  <Button variant="outline">Cancel</Button>
                </DialogClose>
                <Button onClick={handleSave} data-testid="save-section-button">
                  <Save className="h-4 w-4 mr-2" />
                  Save
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <Button
            size="icon"
            variant="ghost"
            className="text-destructive hover:text-destructive"
            onClick={onDelete}
            data-testid={`delete-section-${section.id}`}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
    </Card>
  );
}

function FeatureEditor({ feature, onSave, onDelete }: {
  feature: SiteFeature;
  onSave: (updates: Partial<SiteFeature>) => void;
  onDelete: () => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [title, setTitle] = useState(feature.title);
  const [description, setDescription] = useState(feature.description || "");
  const [icon, setIcon] = useState(feature.icon || "");

  const handleSave = () => {
    onSave({ title, description: description || null, icon: icon || null });
    setIsEditing(false);
  };

  const isEnabled = feature.isEnabled !== false;

  return (
    <Card className={`${!isEnabled ? "opacity-60" : ""}`}>
      <CardHeader className="flex flex-row items-center justify-between gap-4 pb-2">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            {feature.icon && <span className="text-lg">{feature.icon}</span>}
            <CardTitle className="text-base">{feature.title}</CardTitle>
          </div>
          <CardDescription className="mt-1 line-clamp-2">{feature.description}</CardDescription>
        </div>
        <div className="flex items-center gap-1">
          <Button
            size="icon"
            variant="ghost"
            onClick={() => onSave({ isEnabled: !isEnabled })}
            data-testid={`toggle-feature-${feature.id}`}
          >
            {isEnabled ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
          </Button>
          <Dialog open={isEditing} onOpenChange={setIsEditing}>
            <DialogTrigger asChild>
              <Button size="icon" variant="ghost" data-testid={`edit-feature-${feature.id}`}>
                <Pencil className="h-4 w-4" />
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Edit Feature</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Icon (Lucide name)</Label>
                  <Input
                    value={icon}
                    onChange={(e) => setIcon(e.target.value)}
                    placeholder="e.g., Calendar"
                    data-testid="feature-icon-input"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Title</Label>
                  <Input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    data-testid="feature-title-input"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={3}
                    data-testid="feature-description-input"
                  />
                </div>
              </div>
              <DialogFooter>
                <DialogClose asChild>
                  <Button variant="outline">Cancel</Button>
                </DialogClose>
                <Button onClick={handleSave} data-testid="save-feature-button">
                  <Save className="h-4 w-4 mr-2" />
                  Save
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <Button
            size="icon"
            variant="ghost"
            className="text-destructive hover:text-destructive"
            onClick={onDelete}
            data-testid={`delete-feature-${feature.id}`}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
    </Card>
  );
}

function parseFeatures(features: string | null): string[] {
  if (!features) return [];
  try {
    return JSON.parse(features);
  } catch {
    return [];
  }
}

function PricingEditor({ plan, onSave, onDelete }: {
  plan: SitePricingPlan;
  onSave: (updates: Partial<SitePricingPlan>) => void;
  onDelete: () => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(plan.name);
  const [price, setPrice] = useState(plan.price);
  const [description, setDescription] = useState(plan.description || "");
  const [featuresText, setFeaturesText] = useState(parseFeatures(plan.features).join("\n"));
  const [isPopular, setIsPopular] = useState(plan.isPopular || false);

  const handleSave = () => {
    const featuresList = featuresText.split("\n").filter((f: string) => f.trim());
    onSave({
      name,
      price,
      description: description || null,
      features: JSON.stringify(featuresList),
      isPopular,
    });
    setIsEditing(false);
  };

  const isEnabled = plan.isEnabled !== false;

  return (
    <Card className={`${!isEnabled ? "opacity-60" : ""} ${plan.isPopular ? "border-primary" : ""}`}>
      <CardHeader className="flex flex-row items-center justify-between gap-4 pb-2">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <CardTitle className="text-base">{plan.name}</CardTitle>
            {plan.isPopular && (
              <span className="px-2 py-0.5 text-xs font-medium rounded bg-primary text-primary-foreground">
                Popular
              </span>
            )}
          </div>
          <CardDescription className="mt-1">
            {plan.price}
          </CardDescription>
        </div>
        <div className="flex items-center gap-1">
          <Button
            size="icon"
            variant="ghost"
            onClick={() => onSave({ isEnabled: !isEnabled })}
            data-testid={`toggle-plan-${plan.id}`}
          >
            {isEnabled ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
          </Button>
          <Dialog open={isEditing} onOpenChange={setIsEditing}>
            <DialogTrigger asChild>
              <Button size="icon" variant="ghost" data-testid={`edit-plan-${plan.id}`}>
                <Pencil className="h-4 w-4" />
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Edit Pricing Plan</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Plan Name</Label>
                    <Input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      data-testid="plan-name-input"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Price (e.g., $29/month)</Label>
                    <Input
                      value={price}
                      onChange={(e) => setPrice(e.target.value)}
                      data-testid="plan-price-input"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Input
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    data-testid="plan-description-input"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Features (one per line)</Label>
                  <Textarea
                    value={featuresText}
                    onChange={(e) => setFeaturesText(e.target.value)}
                    rows={5}
                    placeholder="Dashboard&#10;Student management&#10;Schedule"
                    data-testid="plan-features-input"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={isPopular}
                    onCheckedChange={setIsPopular}
                    data-testid="plan-popular-switch"
                  />
                  <Label>Mark as Popular</Label>
                </div>
              </div>
              <DialogFooter>
                <DialogClose asChild>
                  <Button variant="outline">Cancel</Button>
                </DialogClose>
                <Button onClick={handleSave} data-testid="save-plan-button">
                  <Save className="h-4 w-4 mr-2" />
                  Save
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <Button
            size="icon"
            variant="ghost"
            className="text-destructive hover:text-destructive"
            onClick={onDelete}
            data-testid={`delete-plan-${plan.id}`}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
    </Card>
  );
}

function FaqEditor({ faq, onSave, onDelete }: {
  faq: SiteFaq;
  onSave: (updates: Partial<SiteFaq>) => void;
  onDelete: () => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [question, setQuestion] = useState(faq.question);
  const [answer, setAnswer] = useState(faq.answer);

  const handleSave = () => {
    onSave({ question, answer });
    setIsEditing(false);
  };

  const isEnabled = faq.isEnabled !== false;

  return (
    <Card className={`${!isEnabled ? "opacity-60" : ""}`}>
      <CardHeader className="flex flex-row items-center justify-between gap-4 pb-2">
        <div className="flex-1">
          <CardTitle className="text-base">{faq.question}</CardTitle>
          <CardDescription className="mt-1 line-clamp-2">{faq.answer}</CardDescription>
        </div>
        <div className="flex items-center gap-1">
          <Button
            size="icon"
            variant="ghost"
            onClick={() => onSave({ isEnabled: !isEnabled })}
            data-testid={`toggle-faq-${faq.id}`}
          >
            {isEnabled ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
          </Button>
          <Dialog open={isEditing} onOpenChange={setIsEditing}>
            <DialogTrigger asChild>
              <Button size="icon" variant="ghost" data-testid={`edit-faq-${faq.id}`}>
                <Pencil className="h-4 w-4" />
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Edit FAQ</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Question</Label>
                  <Input
                    value={question}
                    onChange={(e) => setQuestion(e.target.value)}
                    data-testid="faq-question-input"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Answer</Label>
                  <Textarea
                    value={answer}
                    onChange={(e) => setAnswer(e.target.value)}
                    rows={4}
                    data-testid="faq-answer-input"
                  />
                </div>
              </div>
              <DialogFooter>
                <DialogClose asChild>
                  <Button variant="outline">Cancel</Button>
                </DialogClose>
                <Button onClick={handleSave} data-testid="save-faq-button">
                  <Save className="h-4 w-4 mr-2" />
                  Save
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <Button
            size="icon"
            variant="ghost"
            className="text-destructive hover:text-destructive"
            onClick={onDelete}
            data-testid={`delete-faq-${faq.id}`}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
    </Card>
  );
}

function TestimonialEditor({ testimonial, onSave, onDelete }: {
  testimonial: SiteTestimonial;
  onSave: (updates: Partial<SiteTestimonial>) => void;
  onDelete: () => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(testimonial.name);
  const [role, setRole] = useState(testimonial.role || "");
  const [content, setContent] = useState(testimonial.content);
  const [rating, setRating] = useState(testimonial.rating || 5);

  const handleSave = () => {
    onSave({ name, role: role || null, content, rating });
    setIsEditing(false);
  };

  const isEnabled = testimonial.isEnabled !== false;

  return (
    <Card className={`${!isEnabled ? "opacity-60" : ""}`}>
      <CardHeader className="flex flex-row items-center justify-between gap-4 pb-2">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <CardTitle className="text-base">{testimonial.name}</CardTitle>
            {testimonial.role && (
              <span className="text-sm text-muted-foreground">- {testimonial.role}</span>
            )}
          </div>
          <CardDescription className="mt-1 line-clamp-2">{testimonial.content}</CardDescription>
        </div>
        <div className="flex items-center gap-1">
          <Button
            size="icon"
            variant="ghost"
            onClick={() => onSave({ isEnabled: !isEnabled })}
            data-testid={`toggle-testimonial-${testimonial.id}`}
          >
            {isEnabled ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
          </Button>
          <Dialog open={isEditing} onOpenChange={setIsEditing}>
            <DialogTrigger asChild>
              <Button size="icon" variant="ghost" data-testid={`edit-testimonial-${testimonial.id}`}>
                <Pencil className="h-4 w-4" />
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Edit Testimonial</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Name</Label>
                    <Input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      data-testid="testimonial-name-input"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Role/Title</Label>
                    <Input
                      value={role}
                      onChange={(e) => setRole(e.target.value)}
                      placeholder="e.g., Homeschool Parent"
                      data-testid="testimonial-role-input"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Testimonial</Label>
                  <Textarea
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    rows={4}
                    data-testid="testimonial-content-input"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Rating (1-5)</Label>
                  <Input
                    type="number"
                    min={1}
                    max={5}
                    value={rating}
                    onChange={(e) => setRating(parseInt(e.target.value) || 5)}
                    data-testid="testimonial-rating-input"
                  />
                </div>
              </div>
              <DialogFooter>
                <DialogClose asChild>
                  <Button variant="outline">Cancel</Button>
                </DialogClose>
                <Button onClick={handleSave} data-testid="save-testimonial-button">
                  <Save className="h-4 w-4 mr-2" />
                  Save
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <Button
            size="icon"
            variant="ghost"
            className="text-destructive hover:text-destructive"
            onClick={onDelete}
            data-testid={`delete-testimonial-${testimonial.id}`}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
    </Card>
  );
}

export default function HomepageBuilder() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("sections");

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const { data: sections = [], isLoading: sectionsLoading } = useQuery<SiteSection[]>({
    queryKey: ["/api/admin/cms/sections"],
  });

  const { data: features = [], isLoading: featuresLoading } = useQuery<SiteFeature[]>({
    queryKey: ["/api/admin/cms/features"],
  });

  const { data: pricingPlans = [], isLoading: pricingLoading } = useQuery<SitePricingPlan[]>({
    queryKey: ["/api/admin/cms/pricing"],
  });

  const { data: faqs = [], isLoading: faqsLoading } = useQuery<SiteFaq[]>({
    queryKey: ["/api/admin/cms/faqs"],
  });

  const { data: testimonials = [], isLoading: testimonialsLoading } = useQuery<SiteTestimonial[]>({
    queryKey: ["/api/admin/cms/testimonials"],
  });

  const updateSectionMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: number; updates: Partial<SiteSection> }) => {
      return apiRequest("PATCH", `/api/admin/cms/sections/${id}`, updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/cms/sections"] });
      toast({ title: "Section updated" });
    },
  });

  const deleteSectionMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest("DELETE", `/api/admin/cms/sections/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/cms/sections"] });
      toast({ title: "Section deleted" });
    },
  });

  const createSectionMutation = useMutation({
    mutationFn: async (section: Partial<SiteSection>) => {
      return apiRequest("POST", "/api/admin/cms/sections", section);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/cms/sections"] });
      toast({ title: "Section created" });
    },
  });

  const reorderSectionsMutation = useMutation({
    mutationFn: async (sectionIds: number[]) => {
      return apiRequest("POST", "/api/admin/cms/sections/reorder", { sectionIds });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/cms/sections"] });
    },
  });

  const updateFeatureMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: number; updates: Partial<SiteFeature> }) => {
      return apiRequest("PATCH", `/api/admin/cms/features/${id}`, updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/cms/features"] });
      toast({ title: "Feature updated" });
    },
  });

  const deleteFeatureMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest("DELETE", `/api/admin/cms/features/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/cms/features"] });
      toast({ title: "Feature deleted" });
    },
  });

  const createFeatureMutation = useMutation({
    mutationFn: async (feature: Partial<SiteFeature>) => {
      return apiRequest("POST", "/api/admin/cms/features", feature);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/cms/features"] });
      toast({ title: "Feature created" });
    },
  });

  const updatePricingMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: number; updates: Partial<SitePricingPlan> }) => {
      return apiRequest("PATCH", `/api/admin/cms/pricing/${id}`, updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/cms/pricing"] });
      toast({ title: "Pricing plan updated" });
    },
  });

  const deletePricingMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest("DELETE", `/api/admin/cms/pricing/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/cms/pricing"] });
      toast({ title: "Pricing plan deleted" });
    },
  });

  const createPricingMutation = useMutation({
    mutationFn: async (plan: Partial<SitePricingPlan>) => {
      return apiRequest("POST", "/api/admin/cms/pricing", plan);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/cms/pricing"] });
      toast({ title: "Pricing plan created" });
    },
  });

  const updateFaqMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: number; updates: Partial<SiteFaq> }) => {
      return apiRequest("PATCH", `/api/admin/cms/faqs/${id}`, updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/cms/faqs"] });
      toast({ title: "FAQ updated" });
    },
  });

  const deleteFaqMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest("DELETE", `/api/admin/cms/faqs/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/cms/faqs"] });
      toast({ title: "FAQ deleted" });
    },
  });

  const createFaqMutation = useMutation({
    mutationFn: async (faq: Partial<SiteFaq>) => {
      return apiRequest("POST", "/api/admin/cms/faqs", faq);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/cms/faqs"] });
      toast({ title: "FAQ created" });
    },
  });

  const updateTestimonialMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: number; updates: Partial<SiteTestimonial> }) => {
      return apiRequest("PATCH", `/api/admin/cms/testimonials/${id}`, updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/cms/testimonials"] });
      toast({ title: "Testimonial updated" });
    },
  });

  const deleteTestimonialMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest("DELETE", `/api/admin/cms/testimonials/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/cms/testimonials"] });
      toast({ title: "Testimonial deleted" });
    },
  });

  const createTestimonialMutation = useMutation({
    mutationFn: async (testimonial: Partial<SiteTestimonial>) => {
      return apiRequest("POST", "/api/admin/cms/testimonials", testimonial);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/cms/testimonials"] });
      toast({ title: "Testimonial created" });
    },
  });

  const handleSectionDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = sections.findIndex((s) => s.id === active.id);
      const newIndex = sections.findIndex((s) => s.id === over.id);
      const newOrder = arrayMove(sections, oldIndex, newIndex);
      reorderSectionsMutation.mutate(newOrder.map((s) => s.id));
    }
  };

  const isLoading = sectionsLoading || featuresLoading || pricingLoading || faqsLoading || testimonialsLoading;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 px-4 max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">Homepage Builder</h1>
          <p className="text-muted-foreground">
            Customize your landing page content and layout
          </p>
        </div>
        <Button variant="outline" asChild>
          <a href="/" target="_blank" rel="noopener noreferrer" data-testid="link-preview-site">
            <Eye className="h-4 w-4 mr-2" />
            Preview Site
          </a>
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-6 grid grid-cols-5 w-full">
          <TabsTrigger value="sections" className="flex items-center gap-2" data-testid="tab-sections">
            <LayoutDashboard className="h-4 w-4" />
            <span className="hidden sm:inline">Sections</span>
          </TabsTrigger>
          <TabsTrigger value="features" className="flex items-center gap-2" data-testid="tab-features">
            <Star className="h-4 w-4" />
            <span className="hidden sm:inline">Features</span>
          </TabsTrigger>
          <TabsTrigger value="pricing" className="flex items-center gap-2" data-testid="tab-pricing">
            <DollarSign className="h-4 w-4" />
            <span className="hidden sm:inline">Pricing</span>
          </TabsTrigger>
          <TabsTrigger value="faqs" className="flex items-center gap-2" data-testid="tab-faqs">
            <HelpCircle className="h-4 w-4" />
            <span className="hidden sm:inline">FAQs</span>
          </TabsTrigger>
          <TabsTrigger value="testimonials" className="flex items-center gap-2" data-testid="tab-testimonials">
            <MessageSquareQuote className="h-4 w-4" />
            <span className="hidden sm:inline">Reviews</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="sections" className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold">Page Sections</h2>
            <Button
              size="sm"
              onClick={() =>
                createSectionMutation.mutate({
                  sectionType: "custom",
                  title: "New Section",
                  sortOrder: sections.length,
                  isEnabled: true,
                })
              }
              data-testid="button-add-section"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Section
            </Button>
          </div>

          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleSectionDragEnd}>
            <SortableContext items={sections.map((s) => s.id)} strategy={verticalListSortingStrategy}>
              <div className="space-y-3">
                {sections.map((section) => (
                  <SortableItem key={section.id} id={section.id}>
                    <SectionEditor
                      section={section}
                      onSave={(updates) => updateSectionMutation.mutate({ id: section.id, updates })}
                      onDelete={() => deleteSectionMutation.mutate(section.id)}
                    />
                  </SortableItem>
                ))}
              </div>
            </SortableContext>
          </DndContext>

          {sections.length === 0 && (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-12">
                <LayoutDashboard className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground text-center">
                  No sections yet. Add your first section to get started.
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="features" className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold">Features</h2>
            <Button
              size="sm"
              onClick={() =>
                createFeatureMutation.mutate({
                  title: "New Feature",
                  description: "Feature description",
                  sortOrder: features.length,
                  isEnabled: true,
                })
              }
              data-testid="button-add-feature"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Feature
            </Button>
          </div>

          <div className="space-y-3">
            {features.map((feature) => (
              <FeatureEditor
                key={feature.id}
                feature={feature}
                onSave={(updates) => updateFeatureMutation.mutate({ id: feature.id, updates })}
                onDelete={() => deleteFeatureMutation.mutate(feature.id)}
              />
            ))}
          </div>

          {features.length === 0 && (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Star className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground text-center">
                  No features yet. Add features to highlight on your landing page.
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="pricing" className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold">Pricing Plans</h2>
            <Button
              size="sm"
              onClick={() =>
                createPricingMutation.mutate({
                  name: "New Plan",
                  price: "$0/month",
                  features: "[]",
                  sortOrder: pricingPlans.length,
                  isEnabled: true,
                })
              }
              data-testid="button-add-pricing"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Plan
            </Button>
          </div>

          <div className="space-y-3">
            {pricingPlans.map((plan) => (
              <PricingEditor
                key={plan.id}
                plan={plan}
                onSave={(updates) => updatePricingMutation.mutate({ id: plan.id, updates })}
                onDelete={() => deletePricingMutation.mutate(plan.id)}
              />
            ))}
          </div>

          {pricingPlans.length === 0 && (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-12">
                <DollarSign className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground text-center">
                  No pricing plans yet. Add your subscription plans.
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="faqs" className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold">Frequently Asked Questions</h2>
            <Button
              size="sm"
              onClick={() =>
                createFaqMutation.mutate({
                  question: "New Question?",
                  answer: "Answer goes here.",
                  sortOrder: faqs.length,
                  isEnabled: true,
                })
              }
              data-testid="button-add-faq"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add FAQ
            </Button>
          </div>

          <div className="space-y-3">
            {faqs.map((faq) => (
              <FaqEditor
                key={faq.id}
                faq={faq}
                onSave={(updates) => updateFaqMutation.mutate({ id: faq.id, updates })}
                onDelete={() => deleteFaqMutation.mutate(faq.id)}
              />
            ))}
          </div>

          {faqs.length === 0 && (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-12">
                <HelpCircle className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground text-center">
                  No FAQs yet. Add common questions and answers.
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="testimonials" className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold">Testimonials</h2>
            <Button
              size="sm"
              onClick={() =>
                createTestimonialMutation.mutate({
                  name: "New Review",
                  content: "Testimonial content here.",
                  rating: 5,
                  sortOrder: testimonials.length,
                  isEnabled: true,
                })
              }
              data-testid="button-add-testimonial"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Testimonial
            </Button>
          </div>

          <div className="space-y-3">
            {testimonials.map((testimonial) => (
              <TestimonialEditor
                key={testimonial.id}
                testimonial={testimonial}
                onSave={(updates) => updateTestimonialMutation.mutate({ id: testimonial.id, updates })}
                onDelete={() => deleteTestimonialMutation.mutate(testimonial.id)}
              />
            ))}
          </div>

          {testimonials.length === 0 && (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-12">
                <MessageSquareQuote className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground text-center">
                  No testimonials yet. Add customer reviews.
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
