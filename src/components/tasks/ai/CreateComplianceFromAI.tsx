/**
 * CreateComplianceFromAI — Modal to create compliance record from AI-detected data
 * Phase 4: User-confirmed compliance creation, prefilled from image analysis
 */

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

export interface CreateComplianceFromAIPayload {
  title: string;
  compliance_type?: string;
  expiry_date?: string;
}

const COMPLIANCE_TYPES = [
  "Fire Certificate",
  "Fire Extinguisher Certificate",
  "PAT Test",
  "Gas Safety Certificate",
  "Electrical Certificate",
  "EICR",
  "Other",
];

interface CreateComplianceFromAIProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orgId: string;
  attachmentId?: string | null;
  prefilled?: CreateComplianceFromAIPayload;
  onComplianceCreated?: (complianceId: string) => void;
}

export function CreateComplianceFromAI({
  open,
  onOpenChange,
  orgId,
  attachmentId,
  prefilled,
  onComplianceCreated,
}: CreateComplianceFromAIProps) {
  const { toast } = useToast();
  const [title, setTitle] = useState(prefilled?.title || "");
  const [complianceType, setComplianceType] = useState(prefilled?.compliance_type || "");
  const [expiryDate, setExpiryDate] = useState(prefilled?.expiry_date || "");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open && prefilled) {
      setTitle(prefilled.title || "");
      setComplianceType(prefilled.compliance_type || "");
      setExpiryDate(prefilled.expiry_date || "");
    }
  }, [open, prefilled]);

  const handleSave = async () => {
    if (!title.trim()) {
      toast({ title: "Title required", description: "Please enter a title", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("ai-actions-create-compliance", {
        body: {
          org_id: orgId,
          title: title.trim(),
          compliance_type: complianceType || null,
          expiry_date: expiryDate.trim() || null,
          attachment_id: attachmentId || null,
        },
      });

      if (error) throw error;
      if (!data?.id) throw new Error("No compliance record returned");

      toast({ title: "Compliance record created", description: "Linked to image" });
      onOpenChange(false);
      onComplianceCreated?.(data.id);
    } catch (err: any) {
      toast({
        title: "Failed to create compliance record",
        description: err.message || "Something went wrong",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "rounded-xl bg-surface-gradient",
          "shadow-[3px_5px_8px_rgba(174,174,178,0.25),-3px_-3px_6px_rgba(255,255,255,0.7)]",
          "border-0"
        )}
      >
        <DialogHeader>
          <DialogTitle>Create Compliance Record</DialogTitle>
          <DialogDescription>
            Create a compliance record from AI-detected document details.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="compliance-type">Document Type</Label>
            <select
              id="compliance-type"
              value={complianceType}
              onChange={(e) => setComplianceType(e.target.value)}
              className="flex h-9 w-full rounded-lg border border-input bg-input px-3 py-1 text-sm shadow-engraved"
            >
              <option value="">Select type</option>
              {COMPLIANCE_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="compliance-title">Title</Label>
            <Input
              id="compliance-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Annual Fire Safety Certificate"
              className="shadow-engraved"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="compliance-expiry">Expiry Date</Label>
            <Input
              id="compliance-expiry"
              type="date"
              value={expiryDate}
              onChange={(e) => setExpiryDate(e.target.value)}
              className="shadow-engraved"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={loading} className="shadow-e1">
            {loading ? "Creating…" : "Create & Link"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
