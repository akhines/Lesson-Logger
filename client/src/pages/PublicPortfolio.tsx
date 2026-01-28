import { useQuery } from "@tanstack/react-query";
import { useParams } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Image, FileText, User, Calendar } from "lucide-react";
import { useState } from "react";

interface Label {
  id: number;
  name: string;
  color: string;
}

interface EvidenceItem {
  id: number;
  title: string | null;
  description: string | null;
  fileUrl: string;
  fileType: string;
  fileName: string | null;
  createdAt: string | null;
  labels: Label[];
}

interface PortfolioData {
  studentName: string;
  studentAvatar: string | null;
  labels: Label[];
  evidence: EvidenceItem[];
}

export default function PublicPortfolio() {
  const { token } = useParams<{ token: string }>();
  const [selectedLabel, setSelectedLabel] = useState<number | null>(null);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);

  const { data: portfolio, isLoading, error } = useQuery<PortfolioData>({
    queryKey: ['/api/public/portfolio', token],
    queryFn: async () => {
      const response = await fetch(`/api/public/portfolio/${token}`);
      if (!response.ok) {
        throw new Error('Portfolio not found');
      }
      return response.json();
    },
    enabled: !!token,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" data-testid="loading-spinner" />
      </div>
    );
  }

  if (error || !portfolio) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="max-w-md">
          <CardContent className="p-6 text-center">
            <h2 className="text-xl font-semibold text-foreground mb-2" data-testid="text-error-title">
              Portfolio Not Found
            </h2>
            <p className="text-muted-foreground" data-testid="text-error-message">
              This portfolio link may have expired or is invalid.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const filteredEvidence = selectedLabel
    ? portfolio.evidence.filter(e => e.labels.some(l => l.id === selectedLabel))
    : portfolio.evidence;

  const groupedByLabel = new Map<string, EvidenceItem[]>();
  
  if (selectedLabel) {
    const label = portfolio.labels.find(l => l.id === selectedLabel);
    groupedByLabel.set(label?.name || 'Selected', filteredEvidence);
  } else {
    for (const item of filteredEvidence) {
      if (item.labels.length === 0) {
        const existing = groupedByLabel.get('Uncategorized') || [];
        existing.push(item);
        groupedByLabel.set('Uncategorized', existing);
      } else {
        for (const label of item.labels) {
          const existing = groupedByLabel.get(label.name) || [];
          if (!existing.find(e => e.id === item.id)) {
            existing.push(item);
            groupedByLabel.set(label.name, existing);
          }
        }
      }
    }
  }

  const sortedCategories = Array.from(groupedByLabel.entries()).sort((a, b) => 
    a[0] === 'Uncategorized' ? 1 : b[0] === 'Uncategorized' ? -1 : a[0].localeCompare(b[0])
  );

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30">
      <header className="bg-card border-b sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
              <User className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground" data-testid="text-student-name">
                {portfolio.studentName}'s Portfolio
              </h1>
              <p className="text-sm text-muted-foreground">
                {portfolio.evidence.length} approved work samples
              </p>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6">
        <div className="flex flex-wrap gap-2 mb-6">
          <Badge
            variant={selectedLabel === null ? "default" : "outline"}
            className="cursor-pointer"
            onClick={() => setSelectedLabel(null)}
            data-testid="button-filter-all"
          >
            All ({portfolio.evidence.length})
          </Badge>
          {portfolio.labels.map(label => {
            const count = portfolio.evidence.filter(e => 
              e.labels.some(l => l.id === label.id)
            ).length;
            return (
              <Badge
                key={label.id}
                variant={selectedLabel === label.id ? "default" : "outline"}
                className="cursor-pointer"
                style={{ 
                  backgroundColor: selectedLabel === label.id ? label.color : undefined,
                  borderColor: label.color
                }}
                onClick={() => setSelectedLabel(label.id)}
                data-testid={`button-filter-label-${label.id}`}
              >
                {label.name} ({count})
              </Badge>
            );
          })}
        </div>

        {sortedCategories.map(([categoryName, items]) => (
          <div key={categoryName} className="mb-8">
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2" data-testid={`text-category-${categoryName}`}>
              <span className="w-3 h-3 rounded-full bg-primary" />
              {categoryName}
              <span className="text-sm font-normal text-muted-foreground">
                ({items.length} {items.length === 1 ? 'item' : 'items'})
              </span>
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {items.map(item => (
                <Card 
                  key={item.id} 
                  className="overflow-hidden hover-elevate cursor-pointer"
                  onClick={() => item.fileType === 'image' && setLightboxImage(item.fileUrl)}
                  data-testid={`card-evidence-${item.id}`}
                >
                  {item.fileType === 'image' ? (
                    <div className="aspect-video bg-muted relative overflow-hidden">
                      <img
                        src={item.fileUrl}
                        alt={item.title || 'Student work'}
                        className="w-full h-full object-cover"
                        loading="lazy"
                        data-testid={`img-evidence-${item.id}`}
                      />
                      <div className="absolute inset-0 bg-black/0 hover:bg-black/10 transition-colors flex items-center justify-center">
                        <Image className="h-8 w-8 text-white opacity-0 hover:opacity-100 transition-opacity" />
                      </div>
                    </div>
                  ) : (
                    <div className="aspect-video bg-muted flex items-center justify-center">
                      <FileText className="h-12 w-12 text-muted-foreground" />
                    </div>
                  )}
                  <CardContent className="p-4">
                    <h3 className="font-medium truncate" data-testid={`text-evidence-title-${item.id}`}>
                      {item.title || item.fileName || 'Untitled'}
                    </h3>
                    {item.description && (
                      <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                        {item.description}
                      </p>
                    )}
                    <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                      <Calendar className="h-3 w-3" />
                      {item.createdAt ? new Date(item.createdAt).toLocaleDateString() : 'No date'}
                    </div>
                    {item.labels.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {item.labels.map(label => (
                          <Badge 
                            key={label.id} 
                            variant="outline" 
                            className="text-xs"
                            style={{ borderColor: label.color, color: label.color }}
                          >
                            {label.name}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        ))}

        {filteredEvidence.length === 0 && (
          <Card>
            <CardContent className="p-8 text-center">
              <p className="text-muted-foreground" data-testid="text-no-evidence">
                No approved work samples found.
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {lightboxImage && (
        <div 
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={() => setLightboxImage(null)}
          data-testid="lightbox-overlay"
        >
          <button
            className="absolute top-4 right-4 text-white text-2xl"
            onClick={() => setLightboxImage(null)}
            data-testid="button-close-lightbox"
          >
            &times;
          </button>
          <img
            src={lightboxImage}
            alt="Full size view"
            className="max-w-full max-h-full object-contain"
            data-testid="img-lightbox"
          />
        </div>
      )}

      <footer className="border-t py-4 mt-8">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          Powered by Sunwoven Homeschool
        </div>
      </footer>
    </div>
  );
}
