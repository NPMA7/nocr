CREATE TABLE IF NOT EXISTS public.daily_reports (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    report_date DATE NOT NULL,
    ruijie_mac VARCHAR(50) NOT NULL,
    prefix_name VARCHAR(255),
    location TEXT,
    offline_since TIMESTAMP WITH TIME ZONE,
    online_since TIMESTAMP WITH TIME ZONE,
    status_progress VARCHAR(50) DEFAULT 'Progress',
    issue TEXT,
    tindakan TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(report_date, ruijie_mac)
);

CREATE INDEX IF NOT EXISTS idx_daily_reports_date ON public.daily_reports(report_date);
