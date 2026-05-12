import { apiFetch } from '/shared/api.js';
import { timeAgo } from '/shared/utils.js';
import { state } from './state.js';

function buildCommentEl(c, isReply = false, parentId = null) {
  const isOwn = state.currentUser && state.currentUser.id === c.user_id;
  const initials = ((c.firstname?.[0] || '') + (c.lastname?.[0] || '')).toUpperCase()
                || c.username?.[0]?.toUpperCase() || '?';

  const el = document.createElement('div');
  el.className = isReply ? 'comment-item reply-item' : 'comment-item';
  el.dataset.id = c.id;

  const effectiveParentId = isReply ? parentId : c.id;
  const replyFormId = `reply-form-${c.id}`;

  el.innerHTML = `
    <div class="comment-avatar-sm">${initials}</div>
    <div class="comment-body">
      <div class="comment-header-row">
        <span class="comment-username">${c.username || 'Unknown'}</span>
        <span class="comment-time">${timeAgo(c.created_at)}</span>
        ${isOwn ? `
          <button class="comment-action-btn edit-btn" data-id="${c.id}">แก้ไข</button>
          <button class="comment-action-btn delete-btn" data-id="${c.id}">ลบ</button>
        ` : ''}
      </div>
      <p class="comment-content" id="comment-content-${c.id}">${c.content}</p>
      <div class="comment-edit-form" id="edit-form-${c.id}" hidden>
        <textarea class="comment-textarea edit-textarea" data-id="${c.id}">${c.content}</textarea>
        <div class="comment-edit-actions">
          <button class="comment-cancel-btn cancel-edit-btn" data-id="${c.id}">ยกเลิก</button>
          <button class="btn comment-submit-btn save-edit-btn" data-id="${c.id}">บันทึก</button>
        </div>
      </div>
      <button class="reply-btn${isReply ? ' reply-btn-sm' : ''}" data-parent="${effectiveParentId}" data-form="${replyFormId}">↩ ตอบกลับ</button>
      <div class="reply-form-wrap" id="${replyFormId}" hidden>
        <textarea class="comment-textarea reply-textarea" placeholder="ตอบกลับ..."></textarea>
        <div class="comment-edit-actions">
          <button class="comment-cancel-btn cancel-reply-btn" data-form="${replyFormId}">ยกเลิก</button>
          <button class="btn comment-submit-btn post-reply-btn" data-parent="${effectiveParentId}" data-form="${replyFormId}">ตอบ</button>
        </div>
      </div>
    </div>
  `;

  if (!isReply && c.replies?.length) {
    const repliesWrap = document.createElement('div');
    repliesWrap.className = 'replies-list';
    c.replies.forEach(r => repliesWrap.appendChild(buildCommentEl(r, true, c.id)));
    el.querySelector('.comment-body').appendChild(repliesWrap);
  }

  return el;
}

function wireCommentActions(container, clipKey) {
  container.querySelectorAll('.delete-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('ลบความคิดเห็นนี้?')) return;
      await apiFetch(`/courses/${state.courseId}/comments/${btn.dataset.id}`, 'DELETE');
      loadComments(clipKey);
    });
  });

  container.querySelectorAll('.edit-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.getElementById(`edit-form-${btn.dataset.id}`).hidden = false;
      document.getElementById(`comment-content-${btn.dataset.id}`).hidden = true;
      btn.hidden = true;
      const delBtn = container.querySelector(`.delete-btn[data-id="${btn.dataset.id}"]`);
      if (delBtn) delBtn.hidden = true;
    });
  });

  container.querySelectorAll('.cancel-edit-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.getElementById(`edit-form-${btn.dataset.id}`).hidden = true;
      document.getElementById(`comment-content-${btn.dataset.id}`).hidden = false;
      const editBtn = container.querySelector(`.edit-btn[data-id="${btn.dataset.id}"]`);
      const delBtn  = container.querySelector(`.delete-btn[data-id="${btn.dataset.id}"]`);
      if (editBtn) editBtn.hidden = false;
      if (delBtn)  delBtn.hidden  = false;
    });
  });

  container.querySelectorAll('.save-edit-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const ta = container.querySelector(`.edit-textarea[data-id="${btn.dataset.id}"]`);
      const content = ta.value.trim();
      if (!content) return;
      btn.disabled = true;
      await apiFetch(`/courses/${state.courseId}/comments/${btn.dataset.id}`, 'PATCH', { content });
      loadComments(clipKey);
    });
  });

  container.querySelectorAll('.reply-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.getElementById(btn.dataset.form).hidden = false;
    });
  });

  container.querySelectorAll('.cancel-reply-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.getElementById(btn.dataset.form).hidden = true;
    });
  });

  container.querySelectorAll('.post-reply-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const form = document.getElementById(btn.dataset.form);
      const ta   = form.querySelector('.reply-textarea');
      const content = ta.value.trim();
      if (!content) return;
      btn.disabled = true;
      await apiFetch(`/courses/${state.courseId}/comments/${btn.dataset.parent}/reply`, 'POST', { content });
      loadComments(clipKey);
    });
  });
}

export async function loadComments(clipKey) {
  const list = document.getElementById('commentList');
  if (!list) return;
  list.innerHTML = Array.from({ length: 3 }, () => `
    <div class="comment-item" style="pointer-events:none">
      <div class="comment-avatar-sm skeleton" style="background:none;flex-shrink:0"></div>
      <div class="comment-body" style="flex:1;min-width:0">
        <span class="sk-line sk-line--md skeleton" style="height:11px;margin-bottom:8px"></span>
        <span class="sk-line sk-line--lg skeleton"></span>
        <span class="sk-line sk-line--sm skeleton" style="margin-bottom:0"></span>
      </div>
    </div>`).join('');

  try {
    const data = await apiFetch(`/courses/${state.courseId}/comments?clip_key=${encodeURIComponent(clipKey)}`);
    list.innerHTML = '';

    if (!data.success || !data.comments?.length) {
      list.innerHTML = '<p class="comment-empty">ยังไม่มีความคิดเห็น เป็นคนแรกที่แสดงความเห็น!</p>';
      return;
    }

    data.comments.forEach(c => list.appendChild(buildCommentEl(c)));
    wireCommentActions(list, clipKey);
  } catch {
    list.innerHTML = '<p class="comment-empty">ไม่สามารถโหลดความคิดเห็นได้</p>';
  }
}

export function initCommentForm() {
  const input   = document.getElementById('commentInput');
  const submit  = document.getElementById('commentSubmit');
  const actions = document.getElementById('commentActions');
  const cancel  = document.getElementById('commentCancel');
  if (!input) return;

  input.addEventListener('focus', () => { actions.hidden = false; });
  cancel.addEventListener('click', () => {
    input.value = '';
    actions.hidden = true;
    input.blur();
  });
  submit.addEventListener('click', async () => {
    const content = input.value.trim();
    if (!content || !state.activeClipKey) return;
    submit.disabled = true;
    try {
      await apiFetch(`/courses/${state.courseId}/comments`, 'POST', { clip_key: state.activeClipKey, content });
      input.value = '';
      actions.hidden = true;
      loadComments(state.activeClipKey);
    } finally {
      submit.disabled = false;
    }
  });
}
