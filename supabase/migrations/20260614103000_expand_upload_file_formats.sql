alter table public.uploaded_files
  drop constraint if exists uploaded_files_mime_type_check;

alter table public.uploaded_files
  add constraint uploaded_files_mime_type_check
  check (
    mime_type in (
      'image/png',
      'image/jpeg',
      'image/webp',
      'text/markdown',
      'text/x-markdown',
      'text/plain',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    )
  );

update storage.buckets
set allowed_mime_types = array[
  'image/png',
  'image/jpeg',
  'image/webp',
  'text/markdown',
  'text/x-markdown',
  'text/plain',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
]
where id = 'career-canvas-assets';
