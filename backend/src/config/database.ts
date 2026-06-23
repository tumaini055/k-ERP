import { supabase } from './supabase';

export const db = {
  query: async (text: string, params?: any[]) => {
    const { data, error } = await supabase.rpc('exec_sql', {
      query_text: text,
      query_params: params
    });
    if (error) throw error;
    return data;
  },

  from: (table: string) => supabase.from(table),

  transaction: async <T>(callback: () => Promise<T>): Promise<T> => {
    return callback();
  }
};

export default db;
