alter table audits add column deal_type text not null default 'freelance' check (deal_type in ('freelance', 'generic'));
create index idx_audits_deal_type on audits(deal_type);
