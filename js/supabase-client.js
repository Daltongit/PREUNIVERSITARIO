const SUPABASE_URL = 'https://dsqzdcaonbpdmepaimlv.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRzcXpkY2FvbmJwZG1lcGFpbWx2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQzNjYwODQsImV4cCI6MjA3OTk0MjA4NH0.DbqbVFMsx-TRN5-x2TgfDg7bttMrbvRK_lBeoNDHJ_k';

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
