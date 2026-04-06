"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { DashboardLayout } from "@/components/dashboard/dashboard-layout";
import { ProtectedRoute, useAuth } from "@/contexts/auth-context";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RichTextEditor } from "@/components/settings/rich-text-editor";
import { Textarea } from "@/components/ui/textarea";
import { Globe, ArrowLeft } from "lucide-react";
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

export default function NewContentPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [pageType, setPageType] = useState("STATIC_PAGE");
  const [status, setStatus] = useState("DRAFT");
  const [isPublic, setIsPublic] = useState(true);
  const [allowComments, setAllowComments] = useState(false);
  const [excerpt, setExcerpt] = useState("");
  const [metaTitle, setMetaTitle] = useState("");
  const [metaDescription, setMetaDescription] = useState("");
  const [metaKeywords, setMetaKeywords] = useState("");
  const [ogImage, setOgImage] = useState("");
  const [content, setContent] = useState("");
  const [contentFormat, setContentFormat] = useState<'HTML' | 'MARKDOWN' | 'RICH_TEXT'>("RICH_TEXT");
  // tabs handled as uncontrolled with defaultValue to avoid controlled issues
  const [submitting, setSubmitting] = useState(false);
  const ogFileInputRef = useRef<HTMLInputElement | null>(null);
  const [uploadingOg, setUploadingOg] = useState(false);
  const [publishedAt, setPublishedAt] = useState<string>("");

  useEffect(() => {
    setSlug(slugify(title));
  }, [title]);

  const applyTemplate = (tpl: string) => {
    switch (tpl) {
      case 'ABOUT_US':
        setTitle('About Us');
        setPageType('STATIC_PAGE');
        setStatus('PUBLISHED');
        setExcerpt('Learn about our mission, team, and values.');
        setMetaTitle('About Us | Centre Labs');
        setMetaDescription('Discover Centre Labs: our mission, research excellence, and the team behind premium peptides.');
        setMetaKeywords('about us, centre research, peptides, team, mission');
        setOgImage('');
        setContent(`
<h2>Our Mission</h2>
<p>We advance research by providing rigorously tested, premium peptides with uncompromising quality.</p>
<h2>Our Team</h2>
<p>A multidisciplinary team of chemists and researchers committed to scientific excellence.</p>
<h2>Quality & Compliance</h2>
<ul>
  <li>Stringent QA protocols</li>
  <li>Batch traceability</li>
  <li>Transparent documentation</li>
</ul>
`);
        break;
      case 'CONTACT_US':
        setTitle('Contact Us');
        setPageType('STATIC_PAGE');
        setStatus('PUBLISHED');
        setExcerpt('Reach our support and sales teams.');
        setMetaTitle('Contact Us | Centre Labs');
        setMetaDescription('Contact Centre Labs for product questions, orders, and support.');
        setMetaKeywords('contact, support, sales, centre research');
        setOgImage('');
        setContent(`
<h2>We'd love to hear from you</h2>
<p>Email: support@centreresearch.com<br/>Phone: +1 (555) 123-4567</p>
<h3>Business Hours</h3>
<p>Mon–Fri: 9:00–18:00 (EST)</p>
`);
        break;
      case 'PRIVACY_POLICY':
        setTitle('Privacy Policy');
        setPageType('LEGAL_PAGE');
        setStatus('PUBLISHED');
        setExcerpt('Your privacy matters. Read how we collect and use data.');
        setMetaTitle('Privacy Policy | Centre Labs');
        setMetaDescription('Learn how Centre Labs collects, uses, and safeguards your data.');
        setMetaKeywords('privacy policy, data protection, GDPR');
        setOgImage('');
        setContent(`
<h2>Introduction</h2>
<p>This policy explains what data we collect and how we use it.</p>
<h2>Data We Collect</h2>
<ul>
  <li>Account and order information</li>
  <li>Usage analytics</li>
  <li>Cookies and similar technologies</li>
</ul>
<h2>Your Rights</h2>
<p>You may request access, correction, or deletion of your data.</p>
`);
        break;
      case 'TERMS_OF_SERVICE':
        setTitle('Terms of Service');
        setPageType('LEGAL_PAGE');
        setStatus('PUBLISHED');
        setExcerpt('Please review our terms before using our services.');
        setMetaTitle('Terms of Service | Centre Labs');
        setMetaDescription('Read Centre Labs Terms of Service covering use, liability, and compliance.');
        setMetaKeywords('terms of service, terms, agreement, usage');
        setOgImage('');
        setContent(`
<h2>Acceptance of Terms</h2>
<p>By accessing or using our services, you agree to these terms.</p>
<h2>Use of Services</h2>
<p>Products are for laboratory research only and not for human use.</p>
<h2>Limitation of Liability</h2>
<p>We are not liable for indirect or consequential damages.</p>
<h2>Governing Law</h2>
<p>These terms are governed by applicable state and federal law.</p>
`);
        break;
    }
  };

  const submit = async () => {
    if (!user) {
      toast.error("You must be logged in");
      return;
    }
    if (!title.trim() || !slug.trim() || !content.trim()) {
      toast.error("Title, slug and content are required");
      return;
    }
    setSubmitting(true);
    const resp = await api.createContentPage({
      title: title.trim(),
      slug: slug.replace(/^\//, "").trim(),
      excerpt: excerpt || undefined,
      content,
      contentFormat,
      metaTitle: metaTitle || undefined,
      metaDescription: metaDescription || undefined,
      metaKeywords: metaKeywords || undefined,
      ogImage: ogImage || undefined,
      pageType: pageType as any,
      status: status as any,
      isPublic,
      allowComments,
      authorId: user.id,
      // Only send when provided
      ...(publishedAt ? { publishedAt: new Date(publishedAt).toISOString() } : {}),
    });
    setSubmitting(false);
    if (!resp.success) {
      toast.error(resp.error || "Failed to create page");
      return;
    }
    toast.success("Page created");
    router.push("/content/pages");
  };

  return (
    <ProtectedRoute requiredRoles={["ADMIN", "MANAGER", "STAFF"]}>
      <DashboardLayout>
        <div className="space-y-6 px-2 sm:px-0">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-3">
              <Button variant="outline" onClick={() => router.push('/content/pages')} size="icon" className="shrink-0">
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Create Page</h1>
                <p className="text-sm sm:text-base text-muted-foreground">Compose and publish a new page</p>
              </div>
            </div>
            <div />
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Starter Templates</CardTitle>
              <CardDescription>Quickly bootstrap common pages</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <Button variant="secondary" onClick={() => applyTemplate('ABOUT_US')}>About Us</Button>
                <Button variant="secondary" onClick={() => applyTemplate('CONTACT_US')}>Contact Us</Button>
                <Button variant="secondary" onClick={() => applyTemplate('PRIVACY_POLICY')}>Privacy Policy</Button>
                <Button variant="secondary" onClick={() => applyTemplate('TERMS_OF_SERVICE')}>Terms of Service</Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Page Details</CardTitle>
              <CardDescription>Fill the basic information</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-2 space-y-3">
                  <div>
                    <Label>Title</Label>
                    <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="About Us" />
                  </div>
                  <div>
                    <Label>Slug</Label>
                    <Input value={slug} onChange={(e) => setSlug(slugify(e.target.value))} placeholder="about" />
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
                  {status === 'SCHEDULED' && (
                    <div>
                      <Label>Publish At</Label>
                      <Input type="datetime-local" value={publishedAt} onChange={(e) => setPublishedAt(e.target.value)} />
                    </div>
                  )}
                  <div>
                    <Label>Content Format</Label>
                    <Select value={contentFormat} onValueChange={(v) => setContentFormat(v as any)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="RICH_TEXT">Rich Text</SelectItem>
                        <SelectItem value="HTML">HTML</SelectItem>
                        <SelectItem value="MARKDOWN">Markdown</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Type</Label>
                    <Select value={pageType} onValueChange={setPageType}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="STATIC_PAGE">Static Page</SelectItem>
                        <SelectItem value="BLOG_POST">Blog Post</SelectItem>
                        <SelectItem value="LEGAL_PAGE">Legal Page</SelectItem>
                        <SelectItem value="LANDING_PAGE">Landing Page</SelectItem>
                        <SelectItem value="PRODUCT_PAGE">Product Page</SelectItem>
                        <SelectItem value="CUSTOM_PAGE">Custom Page</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch checked={isPublic} onCheckedChange={setIsPublic} id="isPublic" />
                    <Label htmlFor="isPublic">Public</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch checked={allowComments} onCheckedChange={setAllowComments} id="allowComments" />
                    <Label htmlFor="allowComments">Allow comments</Label>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Content</CardTitle>
              <CardDescription>Write the page body using the editor</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {contentFormat === "RICH_TEXT" ? (
                <RichTextEditor content={content} onChange={setContent} placeholder="Write your page content..." />
              ) : (
                <div className="space-y-2">
                  <Label>{contentFormat === "HTML" ? "HTML" : "Markdown"} Content</Label>
                  <Textarea rows={16} value={content} onChange={(e) => setContent(e.target.value)} placeholder={contentFormat === "HTML" ? "<h1>Your HTML here</h1>" : "# Your markdown here"} />
                </div>
              )}
            </CardContent>
          </Card>

          <Tabs defaultValue="seo">
            <TabsList>
              <TabsTrigger value="seo">SEO</TabsTrigger>
              <TabsTrigger value="social">Social</TabsTrigger>
            </TabsList>
            <TabsContent value="seo" className="grid gap-3 mt-4">
              <Card>
                <CardHeader>
                  <CardTitle>SEO Metadata</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-3">
                  <div>
                    <Label>Meta Title</Label>
                    <Input value={metaTitle} onChange={(e) => setMetaTitle(e.target.value)} placeholder="SEO title" />
                  </div>
                  <div>
                    <Label>Meta Description</Label>
                    <Input value={metaDescription} onChange={(e) => setMetaDescription(e.target.value)} placeholder="SEO description" />
                  </div>
                  <div>
                    <Label>Meta Keywords</Label>
                    <Input value={metaKeywords} onChange={(e) => setMetaKeywords(e.target.value)} placeholder="keyword1, keyword2" />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
            <TabsContent value="social" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle>Social Sharing</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-3">
                  <div>
                    <Label>Open Graph Image URL</Label>
                    <div className="flex gap-2">
                      <Input value={ogImage} onChange={(e) => setOgImage(e.target.value)} placeholder="https://..." />
                      <input
                        ref={ogFileInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          setUploadingOg(true);
                          try {
                            const up = await api.uploadFile(file);
                            if (up.success && up.data?.url) setOgImage(up.data.url);
                          } finally {
                            setUploadingOg(false);
                            if (ogFileInputRef.current) ogFileInputRef.current.value = "";
                          }
                        }}
                      />
                      <Button variant="outline" onClick={() => ogFileInputRef.current?.click()} disabled={uploadingOg}>Upload</Button>
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground flex items-center gap-2">
                    <Globe className="h-4 w-4" /> Used for link previews on social platforms
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          <div className="flex flex-col sm:flex-row justify-end gap-2 px-2 sm:px-0">
            <Button variant="outline" onClick={() => router.push('/content/pages')} className="w-full sm:w-auto order-2 sm:order-1">Cancel</Button>
            <Button onClick={submit} disabled={submitting} className="w-full sm:w-auto order-1 sm:order-2">Create page</Button>
          </div>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}


