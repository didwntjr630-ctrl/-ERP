/* ===================================================
   supabase.js - Supabase 클라이언트 초기화
   운영(Vercel) / 테스트(로컬) 자동 분기
   =================================================== */

var _운영서버 = window.location.hostname === 'erp-red-five.vercel.app';

var 수파베이스 = supabase.createClient(
  _운영서버
    ? 'https://xwgfzobclvdrvuumdeqz.supabase.co'
    : 'https://otsyicyktzmxlpjlzlbt.supabase.co',
  _운영서버
    ? 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh3Z2Z6b2JjbHZkcnZ1dW1kZXF6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI0NDM1MjgsImV4cCI6MjA5ODAxOTUyOH0.HjX7nj0V7oPTAL_VDkI4WElhbP255uKxPOgvSR7dFFM'
    : 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im90c3lpY3lrdHpteGxwamx6bGJ0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI4MDQwMjcsImV4cCI6MjA5ODM4MDAyN30.Bt9dUouefJEKChMa9IrS38Cr-no4Jj-H3YeLV_MBKi8'
);
