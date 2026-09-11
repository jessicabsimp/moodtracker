// Initialize Supabase Client
const SUPABASE_URL = 'https://exghnybsjhxnmydktqch.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV4Z2hueWJzamh4bm15ZGt0cWNoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc0NDAyNDMsImV4cCI6MjEwMzAxNjI0M30.Xz9OEWkUy1RRYR8hxLkGJFnxBUvyZLLV-J89v5emIco';
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleString();
}

function phaseLocalDateKey(value = new Date()) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function phaseEscapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}
