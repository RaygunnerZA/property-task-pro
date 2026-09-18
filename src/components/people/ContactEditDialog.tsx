import { useEffect, useState } from "react";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { modalScrollFooterClass, modalScrollHeaderClass, modalScrollShellClass } from "@/lib/layoutClasses";
import type { Contact, ContactInput, ContactKind } from "@/hooks/useContacts";
import { cn } from "@/lib/utils";

const KIND_OPTIONS: { value: ContactKind; label: string }[] = [
  { value: "contact", label: "Contact" },
  { value: "contractor", label: "Contractor" },
  { value: "supplier", label: "Supplier" },
  { value: "agent", label: "Agent" },
  { value: "other", label: "Other" },
];

type ContactEditDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contact?: Contact | null;
  defaultPropertyId?: string | null;
  saving?: boolean;
  onSave: (input: ContactInput) => Promise<void>;
  onDelete?: () => Promise<void>;
};

export function ContactEditDialog({
  open,
  onOpenChange,
  contact,
  defaultPropertyId,
  saving = false,
  onSave,
  onDelete,
}: ContactEditDialogProps) {
  const isEdit = Boolean(contact?.id);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [roleLabel, setRoleLabel] = useState("");
  const [kind, setKind] = useState<ContactKind>("contact");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setName(contact?.name ?? "");
    setEmail(contact?.email ?? "");
    setPhone(contact?.phone ?? "");
    setRoleLabel(contact?.role_label ?? "");
    setKind((contact?.kind as ContactKind) || "contact");
    setNotes(contact?.notes ?? "");
    setError(null);
  }, [open, contact]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Name is required");
      return;
    }
    setError(null);
    try {
      await onSave({
        name: trimmed,
        email: email.trim() || null,
        phone: phone.trim() || null,
        role_label: roleLabel.trim() || null,
        kind,
        notes: notes.trim() || null,
        property_id: contact?.property_id ?? defaultPropertyId ?? null,
      });
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save contact");
    }
  };

  const handleDelete = async () => {
    if (!onDelete) return;
    setError(null);
    try {
      await onDelete();
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't delete contact");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn(modalScrollShellClass, "sm:max-w-md")}>
        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <DialogHeader className={modalScrollHeaderClass}>
            <DialogTitle>{isEdit ? "Edit contact" : "Add contact"}</DialogTitle>
            <DialogDescription>
              {isEdit
                ? "Update name, details, or role for this person."
                : "Add someone to the People directory — contractor, supplier, or other contact."}
            </DialogDescription>
          </DialogHeader>

          <DialogBody className="space-y-3 px-6 py-4">
            <div className="space-y-1.5">
              <Label htmlFor="contact-name">Name</Label>
              <Input
                id="contact-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="input-neomorphic"
                placeholder="Full name"
                autoFocus
                required
              />
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="contact-email">Email</Label>
                <Input
                  id="contact-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="input-neomorphic"
                  placeholder="name@example.com"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="contact-phone">Phone</Label>
                <Input
                  id="contact-phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="input-neomorphic"
                  placeholder="+44…"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="contact-role">Role</Label>
                <Input
                  id="contact-role"
                  value={roleLabel}
                  onChange={(e) => setRoleLabel(e.target.value)}
                  className="input-neomorphic"
                  placeholder="e.g. Managing agent"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="contact-kind">Type</Label>
                <Select value={kind} onValueChange={(v) => setKind(v as ContactKind)}>
                  <SelectTrigger id="contact-kind" className="input-neomorphic">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {KIND_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="contact-notes">Notes</Label>
              <Textarea
                id="contact-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="input-neomorphic min-h-[72px] resize-none"
                placeholder="Optional context"
              />
            </div>

            {error ? <p className="text-sm text-destructive">{error}</p> : null}
          </DialogBody>

          <DialogFooter className={cn(modalScrollFooterClass, "gap-2 sm:justify-between")}>
            {isEdit && onDelete ? (
              <Button
                type="button"
                variant="ghost"
                className="text-destructive hover:text-destructive"
                disabled={saving}
                onClick={() => void handleDelete()}
              >
                Delete
              </Button>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <Button type="button" variant="ghost" disabled={saving} onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" className="btn-accent-vibrant" disabled={saving}>
                {saving ? "Saving…" : isEdit ? "Save" : "Add contact"}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
