import { classifyIncoming } from './inbox.service';

describe('classifyIncoming', () => {
  const classify = (content: string) =>
    classifyIncoming('buyer@example.com', 'Re: Webinar', content);

  it.each([
    ['Tôi quan tâm?', 'other'],
    ['I am interested?', 'other'],
    ['Tôi không thực sự quan tâm', 'not_interested'],
    ['I am not really interested', 'not_interested'],
    ['Tôi không còn quan tâm', 'not_interested'],
    ['I am no longer interested', 'not_interested'],
    ['Tôi đã nhận được email và cần thêm thông tin', 'need_info'],
    ['Tôi cần thêm thông tin', 'need_info'],
    ['Anh/chị gửi giúp tôi bảng giá nhé', 'need_info'],
    ['Cho tôi xin thông tin chi tiết', 'need_info'],
    ['Bên mình muốn nhận tài liệu sản phẩm', 'need_info'],
    ['Could you share more details?', 'need_info'],
    ['Please send us a quotation', 'need_info'],
    ['Chúng tôi quan tâm đến giải pháp này', 'interested'],
    ['Bên mình muốn đặt lịch demo', 'interested'],
    ['We are interested in your product', 'interested'],
    ['Tôi không có nhu cầu', 'not_interested'],
    ['Bên mình chưa quan tâm', 'not_interested'],
    ['We are not interested', 'not_interested'],
    ['Vui lòng ngừng gửi email cho tôi', 'unsubscribe'],
    ['Please unsubscribe me from your mailing list', 'unsubscribe'],
    ['Tôi không nói rằng tôi quan tâm', 'other'],
    ['I never said I am interested', 'other'],
    ['Tôi không phải là không quan tâm', 'other'],
    ['I am not uninterested', 'other'],
    ['Khách hàng nói tôi quan tâm', 'other'],
    ['He said I am interested', 'other'],
    ['Tôi không cần báo giá nhưng tôi quan tâm', 'interested'],
    ['I am interested but not ready to buy', 'other'],
    ['Tôi có thể quan tâm', 'other'],
    ['Maybe I am interested', 'other'],
    ['Đừng hủy đăng ký cho tôi. Unsubscribe', 'other'],
    [
      'Tôi quan tâm\n----- Thư được chuyển tiếp -----\nUnsubscribe',
      'interested',
    ],
    ['Tôi quan tâm\nCảm ơn,\nUnsubscribe', 'interested'],
    ['Gửi tôi báo giá', 'need_info'],
    ['Please send me pricing details', 'need_info'],
    ['I need more information', 'need_info'],
    ['Tôi quan tâm', 'interested'],
    ['Muốn đặt lịch tư vấn', 'interested'],
    ['I am interested', 'interested'],
    ['I would like to schedule a meeting', 'interested'],
    ['Tôi chưa có nhu cầu', 'not_interested'],
    ['Tôi không quan tâm', 'not_interested'],
    ["I'm not interested", 'not_interested'],
    ['No thanks', 'not_interested'],
    ['Đừng gửi email cho tôi nữa', 'unsubscribe'],
    ['Tôi muốn ngừng nhận email', 'unsubscribe'],
    ['Vui lòng hủy đăng ký nhận email', 'unsubscribe'],
    ['Please remove me from this list', 'unsubscribe'],
    ['Please stop sending me emails', 'unsubscribe'],
    ['Unsubscribe', 'unsubscribe'],
    ['chào bạn', 'other'],
    ['Tôi không muốn ngừng nhận email', 'other'],
    ['Please do not unsubscribe me', 'other'],
    ['Tôi không cần thêm thông tin', 'other'],
    ['I do not need more information', 'other'],
    ['Tôi không quan tâm. Tôi quan tâm.', 'other'],
    ['Tôi chưa có nhu cầu, nhưng gửi tôi báo giá', 'other'],
    ['Tôi quan tâm và cần thêm thông tin', 'need_info'],
    ['Tôi quan tâm. Đừng gửi email cho tôi nữa.', 'unsubscribe'],
    ['Làm sao để ngừng nhận email?', 'other'],
    ['Unsubscribe?', 'other'],
    ['Không gửi email nghĩa là gì?', 'other'],
    ['Tôi nói “ngừng nhận email” chỉ để ví dụ.', 'other'],
    ['Ngừng nhận email là nút gì?', 'other'],
    ["Unsubscribe. I don't want to unsubscribe", 'other'],
    ['Nếu không có báo giá, ngừng nhận email', 'other'],
    ['Ngừng nhận email, nhưng không phải bây giờ', 'other'],
    ['I am interested. Please do not send pricing', 'interested'],
    ['Tôi cần thêm thông tin?', 'need_info'],
    ['Could you send me a quote?', 'need_info'],
    ['Bạn có thể gửi cho tôi báo giá không?', 'need_info'],
    ['Tôi không có nhu cầu nhận thêm thông tin', 'not_interested'],
    ['I am not sure I am interested', 'other'],
    ['Tôi chưa chắc tôi quan tâm', 'other'],
    ['I am interested if the price is lower', 'other'],
    ['Ngừng nhận email. Tôi vẫn muốn nhận email.', 'other'],
    ['Unsubscribe. Please keep sending me emails.', 'other'],
    ['Please do not stop sending emails', 'other'],
    ['Do not send me emails anymore', 'unsubscribe'],
    ["Don't send me any more emails", 'unsubscribe'],
    ['Vui lòng xóa tôi khỏi danh sách gửi email', 'unsubscribe'],
    ['Vui lòng Ẩn tôi khỏi danh sách gửi email', 'other'],
    ['Tôi quan tâm\n--- Forwarded message ---\nUnsubscribe', 'interested'],
    ['Tôi quan tâm\nBegin forwarded message:\nUnsubscribe', 'interested'],
    [
      'Tôi quan tâm\nOn Friday, buyer@example.com wrote:\nUnsubscribe',
      'interested',
    ],
  ])('classifies %s as %s', (content, expected) => {
    expect(classify(content)).toBe(expected);
  });

  it.each([
    'Tôi cần thêm thông tin\n\nOn Fri, Nov 13, buyer@example.com wrote:\nUnsubscribe',
    'Tôi cần thêm thông tin\n\nVào Thứ 7, 14 thg 11, 2026 lúc 18:07\n<sender@example.com> đã\nviết:\nNgừng nhận email',
    'Tôi cần thêm thông tin\n-----Original Message-----\nPlease remove me from this list',
    'Tôi cần thêm thông tin\nFrom: sender@example.com\nSent: Friday\nUnsubscribe',
    'Tôi cần thêm thông tin\n> Unsubscribe\n> I am not interested',
    'Tôi cần thêm thông tin\n-- \nUnsubscribe',
    'Tôi cần thêm thông tin\nTrân trọng,\nNgừng nhận email',
    'Tôi cần thêm thông tin\nSent from my iPhone\nUnsubscribe',
  ])('ignores quoted history and signature in %s', (content) => {
    expect(classify(content)).toBe('need_info');
  });

  it('normalises unicode, case, spaces and Vietnamese without accents', () => {
    expect(classify('  TÔI CẦN THÊM THÔNG TIN  '.normalize('NFD'))).toBe(
      'need_info',
    );
    expect(classify('toi can them thong tin')).toBe('need_info');
    expect(classify('I need   more information')).toBe('need_info');
  });

  it.each([
    ['Gửi giúp tôi bảng giá', 'need_info'],
    ['Chúng tôi quan tâm', 'interested'],
    ['Tôi không thực sự quan tâm', 'not_interested'],
    ['Vui lòng ngừng gửi email cho tôi', 'unsubscribe'],
    ['Tôi không muốn ngừng nhận email', 'other'],
  ])(
    'preserves %s across formatting and quoted-thread variants',
    (reply, expected) => {
      for (const variant of [
        reply.toUpperCase(),
        reply.normalize('NFD'),
        reply.replace(/ /g, '   '),
        `${reply}\r\n\r\nOn Monday, sales@example.com wrote:\r\nUnsubscribe\r\nI am interested`,
        `${reply}\n> Tôi không quan tâm\n> Ngừng nhận email`,
        `${reply}\n-- \nUnsubscribe`,
      ])
        expect(classify(variant)).toBe(expected);
    },
  );

  it('does not use the quoted campaign subject as customer intent', () => {
    expect(
      classifyIncoming('buyer@example.com', 'Re: Unsubscribe', 'Thanks'),
    ).toBe('other');
  });

  it('keeps bounce and automatic reply recognition ahead of content intent', () => {
    expect(
      classifyIncoming(
        'mailer-daemon@example.com',
        'Delivery failure',
        'I am interested',
      ),
    ).toBe('bounce');
    expect(
      classifyIncoming(
        'buyer@example.com',
        'Out of office',
        'I am interested',
        'auto-replied',
      ),
    ).toBe('out_of_office');
  });

  it('does not infer bounce from an ordinary sender containing postmaster', () => {
    expect(
      classifyIncoming(
        'sales-postmaster@example.com',
        'Delivery failure',
        'Tôi cần thêm thông tin',
      ),
    ).toBe('need_info');
    expect(
      classifyIncoming(
        'buyer@example.com',
        'Hello',
        'Tôi quan tâm',
        'not-auto-replied',
      ),
    ).toBe('interested');
  });
});
