-- Authors may delete their own task/conversation messages.
DROP POLICY IF EXISTS "Users can delete their own messages" ON messages;
CREATE POLICY "Users can delete their own messages"
ON messages FOR DELETE
TO authenticated
USING (
  author_user_id = auth.uid()
  AND org_id IN (
    SELECT org_id FROM organisation_members WHERE user_id = auth.uid()
  )
);
