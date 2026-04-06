import { InviteUserForm, type InviteUserFormProps } from "./InviteUserForm";

export type InviteUserModalProps = Omit<InviteUserFormProps, "variant"> & {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

/** Dialog wrapper around {@link InviteUserForm} (`variant="modal"`). */
export function InviteUserModal({ open, onOpenChange, ...rest }: InviteUserModalProps) {
  return <InviteUserForm variant="modal" open={open} onOpenChange={onOpenChange} {...rest} />;
}
