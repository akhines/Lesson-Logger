import { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, BookOpen, Plus, Library, GraduationCap } from "lucide-react";
import { CURRICULUM_OPTIONS, CURRICULUM_CATEGORY_LABELS, SUBJECT_CATEGORY_COLORS } from "@shared/schema";

interface CurriculumItem {
  name: string;
  grades: string;
  category: string;
  categoryLabel: string;
}

interface Props {
  trigger?: React.ReactNode;
  onSelectCurriculum: (curriculum: { name: string; category: string; grades: string }) => void;
}

const CATEGORY_TO_SUBJECT_CATEGORY: Record<string, string> = {
  math: "math",
  reading_phonics: "language_arts",
  spelling: "language_arts",
  grammar: "language_arts",
  writing: "language_arts",
  literature: "language_arts",
};

export function CurriculumBrowserDialog({ trigger, onSelectCurriculum }: Props) {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");

  const allCurricula: CurriculumItem[] = useMemo(() => {
    const items: CurriculumItem[] = [];
    Object.entries(CURRICULUM_OPTIONS).forEach(([category, curricula]) => {
      curricula.forEach((c) => {
        items.push({
          name: c.name,
          grades: c.grades,
          category: CATEGORY_TO_SUBJECT_CATEGORY[category] || "other",
          categoryLabel: CURRICULUM_CATEGORY_LABELS[category] || category,
        });
      });
    });
    return items;
  }, []);

  const categories = useMemo(() => {
    return ["all", ...Object.keys(CURRICULUM_OPTIONS)];
  }, []);

  const filteredCurricula = useMemo(() => {
    return allCurricula.filter((c) => {
      if (selectedCategory !== "all") {
        const categoryKey = Object.entries(CATEGORY_TO_SUBJECT_CATEGORY).find(
          ([key, value]) => value === c.category || key === selectedCategory
        )?.[0];
        if (categoryKey !== selectedCategory && c.category !== selectedCategory) {
          const matchingCategories = Object.entries(CURRICULUM_OPTIONS).find(
            ([key]) => key === selectedCategory
          );
          if (matchingCategories) {
            const isInCategory = matchingCategories[1].some((item) => item.name === c.name);
            if (!isInCategory) return false;
          } else {
            return false;
          }
        }
      }
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        return c.name.toLowerCase().includes(query) || c.grades.toLowerCase().includes(query);
      }
      return true;
    });
  }, [allCurricula, selectedCategory, searchQuery]);

  const handleSelect = (curriculum: CurriculumItem) => {
    onSelectCurriculum({
      name: curriculum.name,
      category: curriculum.category,
      grades: curriculum.grades,
    });
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" className="gap-2" data-testid="button-browse-curriculum">
            <Library className="h-4 w-4" />
            Browse Curriculum
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[700px] max-h-[85vh]">
        <DialogHeader>
          <DialogTitle className="text-2xl font-display flex items-center gap-2">
            <Library className="h-6 w-6" />
            Curriculum Library
          </DialogTitle>
          <DialogDescription>
            Select a curriculum to quickly add it as a new subject
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search curricula..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
              data-testid="input-search-curriculum"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              variant={selectedCategory === "all" ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedCategory("all")}
              data-testid="filter-all"
            >
              All
            </Button>
            {categories.slice(1).map((category) => (
              <Button
                key={category}
                variant={selectedCategory === category ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedCategory(category)}
                data-testid={`filter-${category}`}
              >
                {CURRICULUM_CATEGORY_LABELS[category] || category}
              </Button>
            ))}
          </div>

          <ScrollArea className="h-[400px] pr-4">
            <div className="grid gap-3">
              {filteredCurricula.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <BookOpen className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No curricula found matching your search</p>
                </div>
              ) : (
                filteredCurricula.map((curriculum, index) => (
                  <Card
                    key={`${curriculum.name}-${index}`}
                    className="hover-elevate cursor-pointer transition-all"
                    onClick={() => handleSelect(curriculum)}
                    data-testid={`curriculum-item-${index}`}
                  >
                    <CardContent className="p-4 flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div
                          className="h-10 w-10 rounded-lg flex items-center justify-center shrink-0"
                          style={{ backgroundColor: SUBJECT_CATEGORY_COLORS[curriculum.category] || "#6B7280" }}
                        >
                          <BookOpen className="h-5 w-5 text-white" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-medium truncate">{curriculum.name}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant="secondary" className="text-xs">
                              <GraduationCap className="h-3 w-3 mr-1" />
                              Grades {curriculum.grades}
                            </Badge>
                            <Badge
                              variant="outline"
                              className="text-xs"
                              style={{
                                borderColor: SUBJECT_CATEGORY_COLORS[curriculum.category],
                                color: SUBJECT_CATEGORY_COLORS[curriculum.category],
                              }}
                            >
                              {curriculum.categoryLabel}
                            </Badge>
                          </div>
                        </div>
                      </div>
                      <Button size="sm" className="shrink-0 gap-1" data-testid={`button-add-curriculum-${index}`}>
                        <Plus className="h-4 w-4" />
                        Add
                      </Button>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </ScrollArea>

          <div className="text-sm text-muted-foreground text-center">
            Showing {filteredCurricula.length} of {allCurricula.length} curricula
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
