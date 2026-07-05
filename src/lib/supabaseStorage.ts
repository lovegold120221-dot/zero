import { supabase, handleDbError } from './supabase';

const AVATARS_BUCKET = 'avatars';
const KNOWLEDGE_BUCKET = 'knowledge-base';

export async function uploadAvatar(userId: string, file: File): Promise<string> {
  const ext = file.name.split('.').pop() || 'png';
  const path = `${userId}/avatar.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from(AVATARS_BUCKET)
    .upload(path, file, { upsert: true });

  if (uploadError) throw uploadError;

  const { data: { publicUrl } } = supabase.storage
    .from(AVATARS_BUCKET)
    .getPublicUrl(path);

  await supabase
    .from('user_settings')
    .upsert({ user_id: userId, avatar_url: publicUrl }, { onConflict: 'user_id' });

  return publicUrl;
}

export async function uploadKnowledgeFile(
  userId: string,
  file: File,
): Promise<{ id: string; name: string; type: string; size: number }> {
  const allowedTypes = [
    'text/plain', 'text/csv', 'application/json',
    'application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/msword',
    'text/markdown',
  ];
  if (!allowedTypes.includes(file.type) && !file.name.match(/\.(txt|csv|json|pdf|docx?|md)$/i)) {
    throw new Error(`File type not supported: ${file.type}. Allowed: txt, csv, pdf, doc/docx, json, md`);
  }

  const path = `${userId}/${Date.now()}_${file.name}`;

  const { error: uploadError } = await supabase.storage
    .from(KNOWLEDGE_BUCKET)
    .upload(path, file);

  if (uploadError) throw uploadError;

  const { data: { publicUrl } } = supabase.storage
    .from(KNOWLEDGE_BUCKET)
    .getPublicUrl(path);

  const { data, error } = await supabase
    .from('knowledge_files')
    .insert({
      user_id: userId,
      file_name: file.name,
      file_type: file.type || 'application/octet-stream',
      file_size: file.size,
      storage_path: path,
    })
    .select('id, file_name, file_type, file_size, uploaded_at')
    .single();

  if (error) throw error;

  return {
    id: data.id,
    name: data.file_name,
    type: data.file_type,
    size: data.file_size,
  };
}

export async function listKnowledgeFiles(userId: string): Promise<Array<{
  id: string;
  name: string;
  type: string;
  size: number;
  uploadedAt: string;
  url: string;
}>> {
  const { data, error } = await supabase
    .from('knowledge_files')
    .select('*')
    .eq('user_id', userId)
    .order('uploaded_at', { ascending: false });

  if (error) throw error;

  return (data || []).map((f: any) => {
    const { data: { publicUrl } } = supabase.storage
      .from(KNOWLEDGE_BUCKET)
      .getPublicUrl(f.storage_path);
    return {
      id: f.id,
      name: f.file_name,
      type: f.file_type,
      size: f.file_size,
      uploadedAt: f.uploaded_at,
      url: publicUrl,
    };
  });
}

export async function deleteKnowledgeFile(userId: string, fileId: string): Promise<void> {
  const { data: file, error: findError } = await supabase
    .from('knowledge_files')
    .select('storage_path')
    .eq('id', fileId)
    .eq('user_id', userId)
    .single();

  if (findError || !file) throw new Error('File not found');

  const { error: storageError } = await supabase.storage
    .from(KNOWLEDGE_BUCKET)
    .remove([file.storage_path]);

  if (storageError) throw storageError;

  const { error: dbError } = await supabase
    .from('knowledge_files')
    .delete()
    .eq('id', fileId)
    .eq('user_id', userId);

  if (dbError) throw dbError;
}

export async function fetchKnowledgeFileContent(userId: string, fileId: string): Promise<string | null> {
  const { data: file, error: findError } = await supabase
    .from('knowledge_files')
    .select('storage_path, file_name')
    .eq('id', fileId)
    .eq('user_id', userId)
    .single();

  if (findError || !file) return null;

  const { data, error: downloadError } = await supabase.storage
    .from(KNOWLEDGE_BUCKET)
    .download(file.storage_path);

  if (downloadError || !data) return null;

  try {
    const text = await data.text();
    return `File: ${file.file_name}\nContent:\n${text}`;
  } catch {
    return null;
  }
}

export async function updateKnowledgeDomains(userId: string, domains: string[]): Promise<void> {
  const { error } = await supabase
    .from('user_settings')
    .upsert({ user_id: userId, knowledge_domains: domains }, { onConflict: 'user_id' });

  if (error) throw error;
}
