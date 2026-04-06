"use client";
import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { DashboardLayout } from "@/components/dashboard/dashboard-layout";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RichTextEditor } from "@/components/settings/rich-text-editor";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { Save, ArrowLeft, Code, Type, Eye, Image as ImageIcon } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { ImageUpload } from "@/components/settings/image-upload";
import { sanitizeHtml } from "@/lib/sanitize";

// Function to wrap email content with header and footer
const wrapEmailWithHeaderFooter = (content: string, contentType: 'HTML_CONTENT' | 'TEXT_CONTENT') => {
  if (contentType === 'HTML_CONTENT') {
    // For HTML content, wrap with full email structure
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          /* Reset and base styles */
          * { box-sizing: border-box; }
          body { 
            font-family: Arial, sans-serif; 
            line-height: 1.6; 
            color: #333; 
            margin: 0; 
            padding: 0; 
            background-color: #f4f4f4;
          }
          
          /* Container styles */
          .container { 
            max-width: 600px; 
            margin: 0 auto; 
            background: #ffffff; 
            box-shadow: 0 0 10px rgba(0,0,0,0.1);
          }
          
          /* Header styles */
          .email-header { 
            text-align: center; 
            padding: 20px 0; 
            background-color: #ffffff; 
            display: flex; 
            justify-content: center; 
            align-items: center;
          }
          
          .email-header img {
            max-width: 200px; 
            height: auto; 
            display: block;
          }
          
          /* Content styles */
          .content { 
            padding: 30px; 
            word-wrap: break-word;
            overflow-wrap: break-word;
          }
          
          /* Footer styles */
          .email-footer { 
            background-color: #f8f9fa; 
            padding: 20px; 
            text-align: center; 
            font-size: 14px; 
            color: #666; 
            margin-top: 30px;
          }
          
          /* Responsive typography */
          h1 { font-size: 24px; margin: 0 0 16px 0; }
          h2 { font-size: 20px; margin: 0 0 14px 0; }
          h3 { font-size: 18px; margin: 0 0 12px 0; }
          p { margin: 0 0 16px 0; }
          
          /* Button styles */
          .button, a[style*="display: inline-block"] {
            display: inline-block !important;
            padding: 12px 24px !important;
            background-color: #667eea !important;
            color: #ffffff !important;
            text-decoration: none !important;
            border-radius: 6px !important;
            font-weight: 500 !important;
            text-align: center !important;
            margin: 10px 0 !important;
            font-family: Arial, sans-serif !important;
            font-size: 14px !important;
          }
          
          /* Table styles */
          table {
            width: 100% !important;
            border-collapse: collapse !important;
            margin: 16px 0 !important;
          }
          
          table td, table th {
            padding: 8px !important;
            border: 1px solid #ddd !important;
            text-align: left !important;
          }
          
          table th {
            background-color: #f8f9fa !important;
            font-weight: bold !important;
          }
          
          /* Image styles */
          img {
            max-width: 100% !important;
            height: auto !important;
            display: block !important;
          }
          
          /* Mobile responsive styles */
          @media only screen and (max-width: 600px) {
            .container {
              width: 100% !important;
              margin: 0 !important;
            }
            
            .content {
              padding: 20px !important;
            }
            
            .email-header {
              padding: 15px 0 !important;
            }
            
            .email-header img {
              max-width: 150px !important;
            }
            
            .email-footer {
              padding: 15px !important;
              font-size: 12px !important;
            }
            
            h1 { font-size: 20px !important; }
            h2 { font-size: 18px !important; }
            h3 { font-size: 16px !important; }
            
            .button, a[style*="display: inline-block"] {
              padding: 10px 20px !important;
              font-size: 13px !important;
              width: 100% !important;
              box-sizing: border-box !important;
            }
          }
          
          /* Dark mode support for email clients that support it */
          @media (prefers-color-scheme: dark) {
            body {
              background-color: #1a1a1a;
              color: #ffffff;
            }
            
            .container {
              background: #2d2d2d;
            }
            
            .email-footer {
              background-color: #3d3d3d;
              color: #cccccc;
            }
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="email-header">
            <img src="/logo.png" alt="Centre Physician Directed">
          </div>
          <div class="content">
            ${content}
          </div>
          <div class="email-footer">
            <p>If you have any queries, please contact us at {{storeEmail}} or call {{storePhone}}</p>
            <p>{{storeAddress}}</p>
          </div>
        </div>
      </body>
      </html>
    `;
  } else {
    // For TEXT_CONTENT, just wrap the content with header and footer
    return `
      <div style="max-width: 600px; margin: 0 auto; background: #ffffff; box-shadow: 0 0 10px rgba(0,0,0,0.1);">
        <div style="text-align: center; padding: 20px 0; background-color: #ffffff; display: flex; justify-content: center; align-items: center;">
          <img src="/logo.png" alt="Centre Physician Directed" style="max-width: 80px; width: 100%; height: auto; display: block;">
        </div>
        <div style="padding: 30px; word-wrap: break-word; overflow-wrap: break-word;">
          ${content}
        </div>
        <div style="background-color: #f8f9fa; padding: 20px; text-align: center; font-size: 14px; color: #666; margin-top: 30px;">
          <p>If you have any queries, please contact us at {{storeEmail}} or call {{storePhone}}</p>
          <p>{{storeAddress}}</p>
        </div>
      </div>
    `;
  }
};

export default function EditEmailTemplatePage() {
  const router = useRouter();
  const params = useParams();
  const type = params?.type as string;
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [formData, setFormData] = useState({
    id: '', // <-- add id
    name: "",
    type: type || "",
    subject: "",
    contentType: "HTML_CONTENT" as "HTML_CONTENT" | "TEXT_CONTENT",
    htmlContent: "",
    textContent: "",
    backgroundImages: [] as string[],
    isActive: true,
  });

  // Fetch template only on mount or when type changes
  useEffect(() => {
    let isMounted = true;
    if (!type) return;
    setLoading(true);
    api.get(`/email-templates/${type}`)
      .then(res => {
        if (isMounted) {
          if (res.success && res.data) {
            setFormData({
              id: res.data.id || '', // <-- store id
              name: res.data.name || "",
              type: res.data.type || type,
              subject: res.data.subject || "",
              contentType: res.data.contentType || "HTML_CONTENT",
              htmlContent: res.data.htmlContent || "",
              textContent: res.data.textContent || "",
              backgroundImages: res.data.backgroundImages || [],
              isActive: res.data.isActive ?? true,
            });
            setNotFound(false);
          } else {
            setNotFound(true);
          }
        }
      })
      .catch(() => {
        if (isMounted) setNotFound(true);
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });
    return () => { isMounted = false; };
  }, [type]);

  // Only save on explicit form submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const response = await api.put(`/email-templates/${formData.id}`, {
        name: formData.name,
        subject: formData.subject,
        contentType: formData.contentType,
        htmlContent: formData.contentType === "HTML_CONTENT" ? formData.htmlContent : "",
        textContent: formData.contentType === "TEXT_CONTENT" ? formData.textContent : "",
        backgroundImages: formData.backgroundImages,
        isActive: formData.isActive
      });
      if (response.success) {
        toast.success(response.message || "Email template updated successfully");
        // Stay on the edit page
      } else {
        toast.error("Failed to update template");
      }
    } catch (error) {
      toast.error("Failed to update template");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <span className="text-muted-foreground">Loading template...</span>
        </div>
      </DashboardLayout>
    );
  }

  if (notFound) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center min-h-[400px]">
          <span className="text-destructive mb-4">Email template not found for type: <b>{type}</b></span>
          <Button variant="outline" onClick={() => router.push('/settings?tab=notifications')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="h-full flex flex-col">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <Button variant="outline" size="sm" onClick={() => router.push('/settings?tab=notifications')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Edit Email Template</h1>
            <p className="text-muted-foreground">Update your email template below</p>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex flex-col min-h-0">
          <Card className="flex-1 flex flex-col">
            <CardHeader>
              <CardTitle>Template Details</CardTitle>
              <CardDescription>Configure your email template settings</CardDescription>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col min-h-0">
              <form onSubmit={handleSubmit} className="flex-1 flex flex-col space-y-4">
                <Tabs defaultValue="editor" className="flex-1 flex flex-col">
                  <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="editor" className="flex items-center gap-2">
                      <Code className="h-4 w-4" />
                      Editor
                    </TabsTrigger>
                    <TabsTrigger value="preview" className="flex items-center gap-2">
                      <Eye className="h-4 w-4" />
                      Preview
                    </TabsTrigger>
                    <TabsTrigger value="images" className="flex items-center gap-2">
                      <ImageIcon className="h-4 w-4" />
                      Images
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="editor" className="flex-1 flex flex-col space-y-4 mt-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="template-name">Template Name</Label>
                        <Input
                          id="template-name"
                          value={formData.name}
                          onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
                          placeholder="Enter template name"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="template-type">Template Type</Label>
                        <Input id="template-type" value={formData.type} disabled />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="email-subject">Email Subject</Label>
                      <Input
                        id="email-subject"
                        value={formData.subject}
                        onChange={e => setFormData(prev => ({ ...prev, subject: e.target.value }))}
                        placeholder="Enter email subject"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="content-type">Content Type</Label>
                      <Select
                        value={formData.contentType}
                        onValueChange={(value: "HTML_CONTENT" | "TEXT_CONTENT") =>
                          setFormData(prev => ({ ...prev, contentType: value }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select content type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="HTML_CONTENT">
                            <div className="flex items-center gap-2">
                              <Code className="h-4 w-4" />
                              HTML Content
                            </div>
                          </SelectItem>
                          <SelectItem value="TEXT_CONTENT">
                            <div className="flex items-center gap-2">
                              <Type className="h-4 w-4" />
                              Rich Text Content
                            </div>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2 flex-1 flex flex-col min-h-0">
                      <Label htmlFor="email-content">
                        {formData.contentType === "HTML_CONTENT" ? "HTML Content" : "Email Content"}
                      </Label>
                      <div className="flex-1 min-h-0">
                        {formData.contentType === "HTML_CONTENT" ? (
                          <textarea
                            id="html-content"
                            value={formData.htmlContent}
                            onChange={e => setFormData(prev => ({ ...prev, htmlContent: e.target.value }))}
                            placeholder="Enter HTML content here..."
                            className="w-full h-full min-h-[400px] p-3 border rounded-md font-mono text-sm resize-none"
                          />
                        ) : (
                          <RichTextEditor
                            content={formData.textContent}
                            onChange={content => setFormData(prev => ({ ...prev, textContent: content }))}
                            placeholder="Start writing your email content here..."
                            uploadedImages={formData.backgroundImages || []}
                          />
                        )}
                      </div>
                    </div>

                    {/* <div className="space-y-2">
                <Label htmlFor="background-image">Background Image URL</Label>
                <Input
                  id="background-image"
                  value={formData.backgroundImage || ""}
                  onChange={e => setFormData(prev => ({ ...prev, backgroundImage: e.target.value }))}
                  placeholder="Enter background image URL"
                />
              </div> */}

                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="is-active"
                        checked={formData.isActive}
                        onChange={e => setFormData(prev => ({ ...prev, isActive: e.target.checked }))}
                        className="form-checkbox h-4 w-4"
                      />
                      <Label htmlFor="is-active">Template is active</Label>
                    </div>

                    <div className="flex gap-2 pt-4">
                      <Button type="submit" disabled={saving}>
                        {saving ? "Saving..." : "Save Changes"}
                      </Button>
                    </div>
                  </TabsContent>

                  <TabsContent value="preview" className="space-y-4 mt-4">
                    <div className="space-y-2">
                      <Label>Subject:</Label>
                      <p className="text-sm text-muted-foreground">{formData.subject}</p>
                    </div>
                    <Separator className="my-4" />
                    <div className="space-y-2">
                      <Label>Preview:</Label>
                      {formData.contentType === 'HTML_CONTENT' ? (
                        <div className="border rounded-lg p-0 max-h-96 overflow-y-auto">
                          <div dangerouslySetInnerHTML={{ __html: sanitizeHtml(wrapEmailWithHeaderFooter(formData.htmlContent || '', 'HTML_CONTENT')) }} />
                        </div>
                      ) : (
                        <div className="border rounded-lg p-4 bg-white dark:bg-gray-800 max-h-96 overflow-y-auto">
                          <div className="prose dark:prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: sanitizeHtml(wrapEmailWithHeaderFooter(formData.textContent || '', 'TEXT_CONTENT')) }} />
                        </div>
                      )}
                    </div>
                  </TabsContent>

                  <TabsContent value="images" className="space-y-4 mt-4">
                    <ImageUpload
                      onImagesUploaded={(imageUrls) => setFormData(prev => ({ ...prev, backgroundImages: imageUrls }))}
                      existingImages={formData.backgroundImages || []}
                      maxImages={10}
                    />
                  </TabsContent>
                </Tabs>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
} 