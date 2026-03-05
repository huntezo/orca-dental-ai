-- =====================================================
-- Orca Dental AI - Cases & Storage Migration
-- Run this in Supabase Dashboard SQL Editor
-- =====================================================

-- =====================================================
-- 1. CREATE TABLES
-- =====================================================

-- Profiles table (extends auth.users)
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT,
    subscription_status TEXT DEFAULT 'trial',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Cases table
CREATE TABLE IF NOT EXISTS cases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    patient_code TEXT NOT NULL,
    notes TEXT,
    status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'uploaded', 'processing', 'done', 'failed')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Case files table
CREATE TABLE IF NOT EXISTS case_files (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    file_path TEXT NOT NULL,
    file_name TEXT NOT NULL,
    file_type TEXT NOT NULL CHECK (file_type IN ('xray', 'cbct', 'intraoral', 'other')),
    mime_type TEXT,
    size_bytes BIGINT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- AI Results table
CREATE TABLE IF NOT EXISTS ai_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    model TEXT,
    result_json JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- 2. TRIGGERS
-- =====================================================

-- Auto-update updated_at on cases
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_cases_updated_at
    BEFORE UPDATE ON cases
    FOR EACH ROW
    EXECUTE FUNCTION set_updated_at();

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, full_name)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email)
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for new user signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

-- =====================================================
-- 3. ENABLE RLS
-- =====================================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE case_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_results ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- 4. RLS POLICIES - PROFILES
-- =====================================================

-- Users can view their own profile
CREATE POLICY "Users can view own profile"
    ON profiles FOR SELECT
    USING (id = auth.uid());

-- Users can update their own profile
CREATE POLICY "Users can update own profile"
    ON profiles FOR UPDATE
    USING (id = auth.uid())
    WITH CHECK (id = auth.uid());

-- =====================================================
-- 5. RLS POLICIES - CASES
-- =====================================================

-- Users can view only their own cases
CREATE POLICY "Users can view own cases"
    ON cases FOR SELECT
    USING (user_id = auth.uid());

-- Users can create cases for themselves
CREATE POLICY "Users can create own cases"
    ON cases FOR INSERT
    WITH CHECK (user_id = auth.uid());

-- Users can update only their own cases
CREATE POLICY "Users can update own cases"
    ON cases FOR UPDATE
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

-- Users can delete only their own cases
CREATE POLICY "Users can delete own cases"
    ON cases FOR DELETE
    USING (user_id = auth.uid());

-- =====================================================
-- 6. RLS POLICIES - CASE_FILES
-- =====================================================

-- Users can view only their own files
CREATE POLICY "Users can view own files"
    ON case_files FOR SELECT
    USING (user_id = auth.uid());

-- Users can upload files for themselves
CREATE POLICY "Users can upload own files"
    ON case_files FOR INSERT
    WITH CHECK (user_id = auth.uid());

-- Users can delete only their own files
CREATE POLICY "Users can delete own files"
    ON case_files FOR DELETE
    USING (user_id = auth.uid());

-- =====================================================
-- 7. RLS POLICIES - AI_RESULTS
-- =====================================================

-- Users can view only their own results
CREATE POLICY "Users can view own results"
    ON ai_results FOR SELECT
    USING (user_id = auth.uid());

-- System can insert results (for future use)
CREATE POLICY "System can insert results"
    ON ai_results FOR INSERT
    WITH CHECK (user_id = auth.uid());

-- =====================================================
-- 8. STORAGE SETUP
-- =====================================================

-- Create storage bucket (run this separately if needed)
-- Note: Bucket creation via SQL might require admin privileges
-- Alternative: Create via Supabase Dashboard Storage UI

-- Storage policies for case-files bucket
-- These assume bucket named 'case-files' already exists

-- Policy: Allow users to upload to their own folder
CREATE POLICY "Users can upload to own folder"
    ON storage.objects FOR INSERT
    WITH CHECK (
        bucket_id = 'case-files' AND
        (storage.foldername(name))[1] = auth.uid()::text
    );

-- Policy: Allow users to read their own files
CREATE POLICY "Users can read own files"
    ON storage.objects FOR SELECT
    USING (
        bucket_id = 'case-files' AND
        (storage.foldername(name))[1] = auth.uid()::text
    );

-- Policy: Allow users to delete their own files
CREATE POLICY "Users can delete own files"
    ON storage.objects FOR DELETE
    USING (
        bucket_id = 'case-files' AND
        (storage.foldername(name))[1] = auth.uid()::text
    );

-- =====================================================
-- 9. INDEXES FOR PERFORMANCE
-- =====================================================

CREATE INDEX idx_cases_user_id ON cases(user_id);
CREATE INDEX idx_cases_status ON cases(status);
CREATE INDEX idx_cases_created_at ON cases(created_at DESC);
CREATE INDEX idx_case_files_case_id ON case_files(case_id);
CREATE INDEX idx_case_files_user_id ON case_files(user_id);
CREATE INDEX idx_ai_results_case_id ON ai_results(case_id);

-- =====================================================
-- DONE
-- =====================================================
