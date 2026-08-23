// Initialize Supabase Client
const SUPABASE_URL = 'https://exghnybsjhxnmydktqch.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV4Z2hueWJzamh4bm15ZGt0cWNoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc0NDAyNDMsImV4cCI6MjEwMzAxNjI0M30.Xz9OEWkUy1RRYR8hxLkGJFnxBUvyZLLV-J89v5emIco';
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleString();
}