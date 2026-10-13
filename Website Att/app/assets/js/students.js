import { api } from './api.js';
import { applyTranslations, t } from './i18n.js';
import { toast } from './auth.js';

export function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]
  ));
}

export function renderStudentsPage(page) {
  page.innerHTML = `
    <div class="card">
      <div class="card-head">
        <h3 data-i18n="students_title"></h3>
        <input class="search" id="search" data-i18n-placeholder="search_students">
        <button class="btn btn-primary" id="add" data-i18n="add_student"></button>
      </div>
      <div class="alert alert-error" id="list-error" hidden></div>
      <div id="list"><div class="skeleton" style="height:120px"></div></div>
    </div>

    <div class="modal-backdrop" id="modal" hidden>
      <form class="modal" id="student-form">
        <header><h3 data-i18n="add_student"></h3></header>
        <div class="body">
          <div class="alert alert-error" id="form-error" hidden></div>
          <div class="field">
            <label for="student_code" data-i18n="student_code"></label>
            <input id="student_code" required placeholder="VS-2026-0001">
          </div>
          <div class="field">
            <label for="name_en" data-i18n="student_name_en"></label>
            <input id="name_en" required>
          </div>
          <div class="field">
            <label for="name_ta" data-i18n="student_name_ta"></label>
            <input id="name_ta">
          </div>
          <div class="field">
            <label for="roll_number" data-i18n="roll_number"></label>
            <input id="roll_number">
          </div>
          <div class="field">
            <label for="contact_number" data-i18n="contact_number"></label>
            <input id="contact_number" inputmode="tel">
          </div>
          <div class="field">
            <label for="training_level" data-i18n="training_level"></label>
            <select id="training_level">
              <option value="BEGINNER">Beginner</option>
              <option value="INTERMEDIATE">Intermediate</option>
              <option value="ADVANCED">Advanced</option>
            </select>
          </div>
        </div>
        <footer>
          <button class="btn btn-ghost" type="button" id="close" data-i18n="cancel"></button>
          <button class="btn btn-primary" type="submit" id="save" data-i18n="save"></button>
        </footer>
      </form>
    </div>`;

  const modal = page.querySelector('#modal');
  const form = page.querySelector('#student-form');
  const formError = page.querySelector('#form-error');
  const search = page.querySelector('#search');

  const openModal = () => {
    form.reset();
    formError.hidden = true;
    modal.hidden = false;
    page.querySelector('#student_code').focus();
  };
  const closeModal = () => { modal.hidden = true; };

  page.querySelector('#add').addEventListener('click', openModal);
  page.querySelector('#close').addEventListener('click', closeModal);
  modal.addEventListener('click', (event) => { if (event.target === modal) closeModal(); });

  let searchTimer;
  search.addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => loadList(page, search.value.trim()), 250);
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    formError.hidden = true;
    const save = page.querySelector('#save');
    save.disabled = true;

    try {
      await api.createStudent({
        student_code: form.student_code.value.trim(),
        name_en: form.name_en.value.trim(),
        name_ta: form.name_ta.value.trim() || null,
        roll_number: form.roll_number.value.trim() || null,
        contact_number: form.contact_number.value.trim() || null,
        training_level: form.training_level.value,
      });
      closeModal();
      toast(t('saved'));
      loadList(page, search.value.trim());
    } catch (error) {
      formError.hidden = false;
      formError.textContent = error.message;
    } finally {
      save.disabled = false;
    }
  });

  applyTranslations(page);
  loadList(page, '');
}

async function loadList(page, search) {
  const list = page.querySelector('#list');
  const error = page.querySelector('#list-error');
  error.hidden = true;
  list.innerHTML = '<div class="skeleton" style="height:120px"></div>';

  try {
    const data = await api.listStudents({ search, limit: 50 });

    if (!data.items.length) {
      list.innerHTML = `
        <div class="empty">
          <div class="mark">👥</div>
          <h3 data-i18n="no_students"></h3>
          <p data-i18n="no_students_hint"></p>
        </div>`;
      applyTranslations(list);
      return;
    }

    list.innerHTML = `
      <table>
        <thead>
          <tr>
            <th data-i18n="student_code"></th>
            <th data-i18n="student_name_en"></th>
            <th data-i18n="contact_number"></th>
            <th data-i18n="training_level"></th>
            <th data-i18n="status"></th>
            <th data-i18n="actions"></th>
          </tr>
        </thead>
        <tbody>
          ${data.items.map((student) => `
            <tr>
              <td data-label="${t('student_code')}">${escapeHtml(student.student_code)}</td>
              <td data-label="${t('student_name_en')}">
                ${escapeHtml(student.name_en)}
                ${student.name_ta ? `<div style="color:var(--accent);font-size:13px">${escapeHtml(student.name_ta)}</div>` : ''}
              </td>
              <td data-label="${t('contact_number')}">${escapeHtml(student.contact_number || '—')}</td>
              <td data-label="${t('training_level')}">${escapeHtml(student.training_level || '—')}</td>
              <td data-label="${t('status')}">
                <span class="badge ${student.student_status === 'ACTIVE' ? 'badge-active' : 'badge-inactive'}">
                  ${student.student_status}
                </span>
              </td>
              <td data-label="${t('actions')}">
                ${student.student_status === 'ACTIVE'
                  ? `<button class="btn btn-ghost" data-deactivate="${student.id}" data-i18n="deactivate"></button>`
                  : '—'}
              </td>
            </tr>`).join('')}
        </tbody>
      </table>
      <p style="color:var(--text-muted);font-size:13px;margin:14px 2px 0">
        ${data.items.length} / ${data.meta.total}
      </p>`;

    list.querySelectorAll('[data-deactivate]').forEach((button) => {
      button.addEventListener('click', async () => {
        button.disabled = true;
        try {
          await api.deactivateStudent(button.dataset.deactivate);
          toast(t('saved'));
          loadList(page, search);
        } catch (err) {
          toast(err.message, 'error');
          button.disabled = false;
        }
      });
    });

    applyTranslations(list);
  } catch (err) {
    error.hidden = false;
    error.textContent = err.message;
    list.innerHTML = '';
  }
}
