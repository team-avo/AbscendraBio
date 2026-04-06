"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { DashboardLayout } from "@/components/dashboard/dashboard-layout";
import { ProtectedRoute, useAuth } from "@/contexts/auth-context";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { RichTextEditor } from "@/components/settings/rich-text-editor";
import { ArrowLeft, Upload } from "lucide-react";
import { api } from "@/lib/api";
import { toast } from "sonner";

function slugify(input: string) {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-/]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^\//, "")
    .replace(/\/+/, "/");
}

export default function NewBlogPostPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [status, setStatus] = useState("DRAFT");
  const [isPublic, setIsPublic] = useState(true);
  const [excerpt, setExcerpt] = useState("");
  const [metaTitle, setMetaTitle] = useState("");
  const [metaDescription, setMetaDescription] = useState("");
  const [content, setContent] = useState("");
  const [publishedAt, setPublishedAt] = useState<string>("");
  const [tags, setTags] = useState<string>("");
  const [featuredImage, setFeaturedImage] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const featuredInputRef = useRef<HTMLInputElement | null>(null);
  const [uploadingFeatured, setUploadingFeatured] = useState(false);

  // Starter templates
  type TemplateKey = "RESEARCH_UPDATE" | "ANNOUNCEMENT" | "HOW_TO" | "CASE_STUDY" | "INTERVIEW";
  const templates: Record<TemplateKey, { title: string; excerpt: string; tags: string; content: string; featuredImage?: string; metaTitle?: string; metaDescription?: string }> = {
    RESEARCH_UPDATE: {
      title: "Research Update: Novel Findings in Peptide Pathways",
      excerpt: "Summary of our latest lab results, methodology, and implications for peptide research.",
      tags: "research, update, peptides",
      featuredImage: "",
      metaTitle: "Research Update – PeptideLab",
      metaDescription: "Latest peptide research findings from PeptideLab.",
      content:
        `<h2>Overview</h2><p>Our team conducted a series of experiments examining peptide-mediated healing pathways. This update outlines the methods, results, and next steps.</p>
         <h3>Methodology</h3><ul><li>Controlled in vitro assays</li><li>Validated instrumentation with calibration logs</li><li>Replicated trials across multiple batches</li></ul>
         <h3>Key Findings</h3><p>Observed measurable improvements in cellular response markers under specified conditions. Full dataset available upon request.</p>
         <blockquote>Research use only. Not for human consumption.</blockquote>`
    },
    ANNOUNCEMENT: {
      title: "Company Announcement: New Lab Capabilities & QA Enhancements",
      excerpt: "We are expanding laboratory capabilities and introducing additional quality controls.",
      tags: "announcement, company, quality",
      featuredImage: "",
      metaTitle: "Announcement – PeptideLab",
      metaDescription: "New capabilities and QA processes at PeptideLab.",
      content:
        `<p>We are pleased to announce expanded analytical capabilities including advanced HPLC profiling and additional documentation options.</p>
         <h3>What’s New</h3><ul><li>Additional analytical panels</li><li>Enhanced batch traceability</li><li>Streamlined documentation for researchers</li></ul>
         <p>These updates reinforce our commitment to physician grade quality.</p>`
    },
    HOW_TO: {
      title: "How-To: Best Practices for Handling Lyophilized Peptides",
      excerpt: "Step-by-step guidance on storage, reconstitution, and handling in research environments.",
      tags: "how-to, guide, handling",
      content:
        `<h2>Before You Begin</h2><p>Review lab SOPs and verify cold-chain integrity for sensitive materials.</p>
         <h3>Storage</h3><p>Maintain at -20°C ± 2°C in a dry environment. Protect from repeated freeze-thaw cycles.</p>
         <h3>Reconstitution</h3><ol><li>Use sterile water under aseptic conditions.</li><li>Mix gently—avoid vortexing.</li><li>Aliquot to minimize freeze-thaw.</li></ol>
         <h3>Documentation</h3><p>Record lot, date, and conditions for reproducibility.</p>`
    },
    CASE_STUDY: {
      title: "Case Study: Process Optimization for Consistent Purity",
      excerpt: "A behind-the-scenes look at improving purity outcomes through process optimization.",
      tags: "case-study, purity, process",
      content:
        `<h2>Objective</h2><p>Increase purity consistency while maintaining throughput.</p>
         <h3>Approach</h3><ul><li>Parameter scans across key steps</li><li>In-process analytics</li><li>Root-cause analysis</li></ul>
         <h3>Outcome</h3><p>Achieved ≥99.9% (HPLC) consistency across validation runs.</p>`
    },
    INTERVIEW: {
      title: "Interview: Q&A with Lead Researcher on Peptide Stability",
      excerpt: "Insights from our lead researcher on stability considerations and lab practices.",
      tags: "interview, stability, lab",
      content:
        `<h2>Q&A Highlights</h2><p><strong>Q:</strong> What factors most impact stability?<br/><strong>A:</strong> Temperature control, moisture exposure, and container headspace are critical.</p>
         <p><strong>Q:</strong> How do you approach documentation?<br/><strong>A:</strong> We emphasize comprehensive run logs and environmental monitoring.</p>`
    }
  };

  const applyTemplate = (key: TemplateKey) => {
    const t = templates[key];
    setTitle(t.title);
    setExcerpt(t.excerpt);
    setContent(t.content);
    setTags(t.tags);
    if (t.featuredImage) setFeaturedImage(t.featuredImage);
    if (t.metaTitle) setMetaTitle(t.metaTitle);
    if (t.metaDescription) setMetaDescription(t.metaDescription);
  };

  useEffect(() => {
    const base = slugify(title);
    setSlug(`blog/${base}`);
  }, [title]);

  const submit = async () => {
    if (!user) return toast.error("You must be logged in");
    if (!title.trim() || !slug.trim() || !content.trim()) return toast.error("Title, slug and content are required");
    setSubmitting(true);
    const resp = await api.createContentPage({
      title: title.trim(),
      slug: slug.replace(/^\//, ""),
      excerpt: excerpt || undefined,
      content,
      contentFormat: "RICH_TEXT",
      metaTitle: metaTitle || undefined,
      metaDescription: metaDescription || undefined,
      ogImage: featuredImage || undefined,
      pageType: 'BLOG_POST',
      status: status as any,
      isPublic,
      allowComments: true,
      authorId: user.id,
      // tagIds: would be mapped from selected tags if we had tag management UI
      publishedAt: publishedAt ? new Date(publishedAt).toISOString() : undefined,
    } as any);
    setSubmitting(false);
    if (!resp.success) return toast.error(resp.error || "Failed to create post");
    toast.success("Post created");
    router.push("/content/blog");
  };

  return (
    <ProtectedRoute requiredRoles={["ADMIN", "MANAGER", "STAFF"]}>
      <DashboardLayout>
        <div className="space-y-6 px-2 sm:px-0">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-3">
              <Button variant="outline" onClick={() => router.push('/content/blog')} size="icon" className="shrink-0">
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">New Blog Post</h1>
                <p className="text-sm sm:text-base text-muted-foreground">Compose and schedule a blog post</p>
              </div>
            </div>
            <div />
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Post Details</CardTitle>
              <CardDescription>Title, slug, visibility and scheduling</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-2 space-y-3">
                <div>
                  <Label>Title</Label>
                  <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Breakthrough in Peptide Research" />
                </div>
                <div>
                  <Label>Slug</Label>
                  <Input value={slug} onChange={(e) => setSlug(slugify(e.target.value))} placeholder="blog/breakthrough-in-peptide-research" />
                </div>
                <div>
                  <Label>Excerpt</Label>
                  <Input value={excerpt} onChange={(e) => setExcerpt(e.target.value)} placeholder="Short summary..." />
                </div>
              </div>
              <div className="space-y-3">
                <div>
                  <Label>Status</Label>
                  <Select value={status} onValueChange={setStatus}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="DRAFT">Draft</SelectItem>
                      <SelectItem value="PUBLISHED">Published</SelectItem>
                      <SelectItem value="SCHEDULED">Scheduled</SelectItem>
                      <SelectItem value="ARCHIVED">Archived</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Publish At</Label>
                  <Input type="datetime-local" value={publishedAt} onChange={(e) => setPublishedAt(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Featured Image URL</Label>
                  <div className="flex gap-2">
                    <Input value={featuredImage} onChange={(e) => setFeaturedImage(e.target.value)} placeholder="https://..." />
                    <input
                      ref={featuredInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        setUploadingFeatured(true);
                        try {
                          const up = await api.uploadFile(file);
                          if (up.success && up.data?.url) setFeaturedImage(up.data.url);
                        } finally {
                          setUploadingFeatured(false);
                          if (featuredInputRef.current) featuredInputRef.current.value = "";
                        }
                      }}
                    />
                    <Button variant="outline" disabled={uploadingFeatured} onClick={() => featuredInputRef.current?.click()}>
                      <Upload className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Tags (comma-separated)</Label>
                  <Input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="peptides, research, bpc-157" />
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={isPublic} onCheckedChange={setIsPublic} id="isPublic" />
                  <Label htmlFor="isPublic">Public</Label>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Starter Templates</CardTitle>
              <CardDescription>Quickly scaffold a professional post</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                <Button variant="outline" onClick={() => applyTemplate("RESEARCH_UPDATE")}>Research Update</Button>
                <Button variant="outline" onClick={() => applyTemplate("ANNOUNCEMENT")}>Company Announcement</Button>
                <Button variant="outline" onClick={() => applyTemplate("HOW_TO")}>How-To Guide</Button>
                <Button variant="outline" onClick={() => applyTemplate("CASE_STUDY")}>Case Study</Button>
                <Button variant="outline" onClick={() => applyTemplate("INTERVIEW")}>Interview</Button>
              </div>
              <p className="text-xs text-muted-foreground mt-3">Choosing a template will pre-fill title, excerpt, body, and tags. You can edit everything afterward.</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Content</CardTitle>
              <CardDescription>Write the post body</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <RichTextEditor content={content} onChange={setContent} placeholder="Write your post content..." />
              <div className="flex flex-col sm:flex-row justify-end gap-2">
                <Button variant="outline" onClick={() => router.push('/content/blog')} className="w-full sm:w-auto order-2 sm:order-1">Cancel</Button>
                <Button onClick={submit} disabled={submitting} className="w-full sm:w-auto order-1 sm:order-2">Create post</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}


