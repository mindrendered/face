import { supabase } from '@/db/supabase';

export interface ScriptResult {
  title: string;
  script: string;
  video_prompt: string;
  duration_estimate: number;
}

export const generationApi = {
  generateScript: async (params: {
    niche: string;
    language: string;
    visual_style: string;
    tone?: string;
  }): Promise<ScriptResult> => {
    const { data, error } = await supabase.functions.invoke('generate-script', { body: params });
    if (error) throw new Error(error.message);
    if (data?.success === false) throw new Error(data?.error || 'Script generation failed');
    if (!data?.success) throw new Error(data?.error || 'Script generation failed');
    return data.data as ScriptResult;
  },

  submitVideo: async (params: {
    prompt: string;
    aspect_ratio?: string;
    duration?: string;
    external_task_id?: string;
  }): Promise<{ task_id: string; task_status: string }> => {
    const { data, error } = await supabase.functions.invoke('kling-omni-video-submit', {
      body: { ...params, aspect_ratio: params.aspect_ratio || '9:16', duration: params.duration || '5' },
    });
    if (error) throw new Error(error.message);
    if (data?.success === false) throw new Error(data?.error || 'Video submit failed');
    // Successful submit: data.code === 0
    if (data?.code !== 0) throw new Error(`Video submit error: ${data?.message}`);
    return data.data as { task_id: string; task_status: string };
  },

  queryVideo: async (taskId: string): Promise<{
    task_status: string;
    task_status_msg?: string;
    task_result?: { videos: Array<{ id: string; url: string; duration: string }> };
  }> => {
    const { data, error } = await supabase.functions.invoke('kling-omni-video-query', { body: { task_id: taskId } });
    if (error) throw new Error(error.message);
    if (data?.success === false) throw new Error(data?.error || 'Query failed');
    return data.data;
  },
};
