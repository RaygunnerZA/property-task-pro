import { useMemo, useState } from "react";
import { Pencil, Plus, UserRound } from "lucide-react";
import { toast } from "sonner";
import { RecentPanel, RecentPanelRow } from "@/components/property-workspace";
import { ContactEditDialog } from "@/components/people/ContactEditDialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  useContacts,
  type Contact,
  type ContactInput,
} from "@/hooks/useContacts";
import { cn } from "@/lib/utils";

type ContactsDirectoryProps = {
  propertyId?: string | null;
  searchQuery?: string;
  className?: string;
};

function contactCaption(contact: Contact): string {
  const bits = [
    contact.role_label?.trim() || kindLabel(contact.kind),
    contact.phone?.trim() || contact.email?.trim() || null,
  ].filter(Boolean);
  return bits.join(" · ");
}

function kindLabel(kind: string): string {
  switch (kind) {
    case "contractor":
      return "Contractor";
    case "supplier":
      return "Supplier";
    case "agent":
      return "Agent";
    case "other":
      return "Other";
    default:
      return "Contact";
  }
}

/**
 * People left-column contacts directory — pressed Recent rows + add/edit dialog.
 * Reference: Assets RecentPanel language (one surface per row, no nested cards).
 */
export function ContactsDirectory({
  propertyId,
  searchQuery = "",
  className,
}: ContactsDirectoryProps) {
  const {
    contacts,
    isLoading,
    createContact,
    updateContact,
    deleteContact,
    isSaving,
  } = useContacts(propertyId);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Contact | null>(null);

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return contacts;
    return contacts.filter((c) => {
      const hay = [c.name, c.email, c.phone, c.role_label, c.kind, c.notes]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [contacts, searchQuery]);

  const openAdd = () => {
    setEditing(null);
    setDialogOpen(true);
  };

  const openEdit = (contact: Contact) => {
    setEditing(contact);
    setDialogOpen(true);
  };

  const handleSave = async (input: ContactInput) => {
    if (editing?.id) {
      await updateContact({ id: editing.id, ...input });
      toast.success("Contact updated");
    } else {
      await createContact(input);
      toast.success("Contact added");
    }
  };

  const handleDelete = async () => {
    if (!editing?.id) return;
    await deleteContact(editing.id);
    toast.success("Contact removed");
  };

  return (
    <div className={cn("w-full min-w-0 pt-1", className)}>
      <RecentPanel
        title="Contacts"
        action={
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 gap-1 px-2 text-2xs font-mono uppercase tracking-[0.08em] text-muted-foreground hover:text-foreground"
            onClick={openAdd}
          >
            <Plus className="h-3.5 w-3.5" aria-hidden />
            Add
          </Button>
        }
        empty={
          isLoading ? null : (
            <div className="space-y-2 py-4 text-center">
              <p className="text-xs text-muted-foreground">
                {searchQuery.trim() ? "No contacts match your search." : "No contacts yet."}
              </p>
              {!searchQuery.trim() ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 gap-1.5 text-xs text-primary"
                  onClick={openAdd}
                >
                  <Plus className="h-3.5 w-3.5" aria-hidden />
                  Add contact
                </Button>
              ) : null}
            </div>
          )
        }
      >
        {!isLoading
          ? filtered.map((contact) => (
              <RecentPanelRow
                key={contact.id}
                onClick={() => openEdit(contact)}
                icon={<UserRound className="h-4 w-4 text-primary" aria-hidden />}
                title={contact.name}
                caption={contactCaption(contact)}
                trailing={
                  <Pencil className="h-3.5 w-3.5 text-muted-foreground/70" aria-hidden />
                }
              />
            ))
          : null}
      </RecentPanel>

      {isLoading ? (
        <div className="mt-1.5 space-y-2">
          <Skeleton className="h-12 w-full rounded-[5px]" />
          <Skeleton className="h-12 w-full rounded-[5px]" />
        </div>
      ) : null}

      <ContactEditDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        contact={editing}
        defaultPropertyId={propertyId}
        saving={isSaving}
        onSave={handleSave}
        onDelete={editing ? handleDelete : undefined}
      />
    </div>
  );
}
