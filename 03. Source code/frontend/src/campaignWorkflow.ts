type CampaignStep = { status: string; subject?: string | null; sender_account_id?: string | null; scheduled_at?: string | null };
export function campaignStage(campaign: CampaignStep) {
  if (campaign.status !== 'approved') return campaign.status;
  return campaign.scheduled_at ? 'confirmation' : campaign.sender_account_id ? 'sender' : campaign.subject ? 'content' : 'approved';
}
export function campaignLabel(campaign: CampaignStep) {
  return ({ draft: 'Chọn danh sách contact', pending_approval: 'Chờ kiểm tra danh sách', rejected: 'Danh sách không đạt', approved: 'Danh sách đã duyệt', content: 'Đã có nội dung', sender: 'Đã chọn tài khoản', confirmation: 'Chờ xác nhận', scheduled: 'Đã lên lịch', sending: 'Đang gửi', paused: 'Đã tạm dừng', completed: 'Hoàn thành' } as Record<string, string>)[campaignStage(campaign)] || campaign.status;
}
export function campaignNext(campaign: CampaignStep) {
  return ({ rejected: 'campaign-contacts', approved: 'campaign-email', content: 'campaign-sender', sender: 'campaign-schedule', confirmation: 'campaign-confirm' } as Record<string, string>)[campaignStage(campaign)];
}
