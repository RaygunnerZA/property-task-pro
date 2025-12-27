import { useState, useRef } from "react";
import { useActiveOrg } from "@/hooks/useActiveOrg";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, Plus, Upload } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface DocumentUploadDialogProps {
  onDocumentCreated?: () => void;
}

export function DocumentUploadDialog({
  onDocumentCreated,
}: DocumentUploadDialogProps) {
  const [open, setOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const { orgId } = useActiveOrg();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form state
  const [title, setTitle] = useState("");
  const [expiryDate, setExpiryDate] = useState<Date | undefined>(undefined);
  const [status, setStatus] = useState<string>("valid");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileName, setFileName] = useState<string>("");

  const statusOptions = [
    { value: "valid", label: "Valid" },
    { value: "expired", label: "Expired" },
  ];

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setFileName(file.name);
    }
  };

  const handleSave = async () => {
    if (!orgId) {
      toast.error("Organization not found");
      return;
    }

    if (!title.trim()) {
      toast.error("Please enter a document title");
      return;
    }

    if (!selectedFile) {
      toast.error("Please select a file to upload");
      return;
    }

    setIsSaving(true);

    try {
      // Upload file to Supabase Storage
      const fileExt = selectedFile.name.split(".").pop();
      const fileName = `${orgId}/${Date.now()}.${fileExt}`;
      
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("compliance-docs")
        .upload(fileName, selectedFile, {
          cacheControl: "3600",
          upsert: false,
        });

      if (uploadError) {
        throw uploadError;
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from("compliance-docs")
        .getPublicUrl(fileName);

      const fileUrl = urlData.publicUrl;

      // Insert document record
      const { error: insertError } = await supabase
        .from("compliance_documents")
        .insert({
          org_id: orgId,
          title: title.trim(),
          expiry_date: expiryDate ? format(expiryDate, "yyyy-MM-dd") : null,
          status: status,
          file_url: fileUrl,
        } as any); // Type assertion needed until types are regenerated

      if (insertError) {
        // If insert fails, try to delete the uploaded file
        await supabase.storage.from("compliance-docs").remove([fileName]);
        throw insertError;
      }

      toast.success("Document uploaded successfully");
      setOpen(false);
      // Reset form
      setTitle("");
      setExpiryDate(undefined);
      setStatus("valid");
      setSelectedFile(null);
      setFileName("");
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      // Refresh documents
      onDocumentCreated?.();
    } catch (err: any) {
      console.error("Error uploading document:", err);
      toast.error(err.message || "Failed to upload document");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          className={cn(
            "rounded-xl bg-gradient-to-br from-[#F4F3F0] via-[#F2F1ED] to-[#EFEDE9]",
            "shadow-[3px_5px_8px_rgba(174,174,178,0.25),-3px_-3px_6px_rgba(255,255,255,0.7),inset_1px_1px_1px_rgba(255,255,255,0.6)]",
            "hover:scale-[1.01] active:scale-[0.99] transition-all duration-150",
            "text-foreground border-0"
          )}
        >
          <Plus className="h-4 w-4 mr-2" />
          Upload Document
        </Button>
      </DialogTrigger>
      <DialogContent
        className={cn(
          "rounded-xl bg-gradient-to-br from-[#F4F3F0] via-[#F2F1ED] to-[#EFEDE9]",
          "shadow-[3px_5px_8px_rgba(174,174,178,0.25),-3px_-3px_6px_rgba(255,255,255,0.7)]",
          "border-0"
        )}
      >
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold">
            Upload Compliance Document
          </DialogTitle>
          <DialogDescription>
            Add a new compliance document to your registry
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="title">Title *</Label>
            <Input
              id="title"
              placeholder="e.g., Fire Safety Certificate"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className={cn(
                "rounded-xl bg-[#F6F4F2]",
                "shadow-[inset_2px_2px_4px_rgba(0,0,0,0.08),inset_-2px_-2px_4px_rgba(255,255,255,0.7)]",
                "border-0 focus:ring-2 focus:ring-[#0EA5E9]/30"
              )}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="expiry">Expiry Date</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal rounded-xl bg-[#F6F4F2]",
                    "shadow-[inset_2px_2px_4px_rgba(0,0,0,0.08),inset_-2px_-2px_4px_rgba(255,255,255,0.7)]",
                    "border-0",
                    !expiryDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {expiryDate ? format(expiryDate, "PPP") : "Pick a date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={expiryDate}
                  onSelect={setExpiryDate}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>
          <div className="space-y-2">
            <Label htmlFor="status">Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger
                id="status"
                className={cn(
                  "rounded-xl bg-[#F6F4F2]",
                  "shadow-[inset_2px_2px_4px_rgba(0,0,0,0.08),inset_-2px_-2px_4px_rgba(255,255,255,0.7)]",
                  "border-0"
                )}
              >
                <SelectValue placeholder="Select status" />
              </SelectTrigger>
              <SelectContent>
                {statusOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="file">File *</Label>
            <div className="flex items-center gap-2">
              <Input
                id="file"
                type="file"
                ref={fileInputRef}
                onChange={handleFileSelect}
                className={cn(
                  "rounded-xl bg-[#F6F4F2]",
                  "shadow-[inset_2px_2px_4px_rgba(0,0,0,0.08),inset_-2px_-2px_4px_rgba(255,255,255,0.7)]",
                  "border-0 focus:ring-2 focus:ring-[#0EA5E9]/30"
                )}
              />
            </div>
            {fileName && (
              <p className="text-sm text-muted-foreground flex items-center gap-2">
                <Upload className="h-4 w-4" />
                {fileName}
              </p>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={isSaving}
            className={cn(
              "rounded-xl bg-[#F6F4F2]",
              "shadow-[inset_2px_2px_4px_rgba(0,0,0,0.08),inset_-2px_-2px_4px_rgba(255,255,255,0.7)]",
              "border-0"
            )}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={isSaving || !title.trim() || !selectedFile}
            className={cn(
              "rounded-xl text-white",
              "shadow-[3px_5px_5px_2px_rgba(0,0,0,0.13),-3px_-3px_5px_0px_rgba(255,255,255,0.48),inset_1px_1px_2px_0px_rgba(255,255,255,0.5),inset_-1px_-2px_2px_0px_rgba(0,0,0,0.27)]",
              "bg-[#FF6B6B] border-0"
            )}
          >
            {isSaving ? "Uploading..." : "Upload Document"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

