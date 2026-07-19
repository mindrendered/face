
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'generated-media',
  'generated-media',
  true,
  524288000,
  ARRAY['video/mp4', 'video/webm', 'video/quicktime', 'image/jpeg', 'image/png', 'image/webp']
);

CREATE POLICY "generated_media_public_read" ON storage.objects FOR SELECT TO public USING (bucket_id = 'generated-media');
CREATE POLICY "generated_media_auth_insert" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'generated-media');
CREATE POLICY "generated_media_auth_delete" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'generated-media' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "generated_media_service_all" ON storage.objects FOR ALL TO service_role USING (bucket_id = 'generated-media');
