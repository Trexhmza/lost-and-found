-- Add UPDATE policy for comments (owner can update own comments)
CREATE POLICY "Users can update own comments"
  ON public.comments FOR UPDATE USING (auth.uid() = user_id);

-- Add UPDATE policy for messages (sender can update own messages)
CREATE POLICY "Users can update own messages"
  ON public.messages FOR UPDATE USING (auth.uid() = sender_id);

-- Add DELETE policy for messages (sender can delete own messages)
CREATE POLICY "Users can delete own messages"
  ON public.messages FOR DELETE USING (auth.uid() = sender_id);
