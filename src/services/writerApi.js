import { getToken, clearToken } from './auth.js';

async function request(method, path, body) {
  const opts = {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${getToken()}`,
    },
  };
  if (body !== undefined) opts.body = JSON.stringify(body);
  const res = await fetch(`/api/writer${path}`, opts);
  if (res.status === 401) {
    clearToken();
    window.dispatchEvent(new Event('auth:logout'));
    throw new Error('Sesja wygasła');
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

export const getProjects = () => request('GET', '/projects');
export const createProject = (data) => request('POST', '/projects', data);
export const getProject = (id) => request('GET', `/projects/${id}`);
export const updateProject = (id, data) => request('PUT', `/projects/${id}`, data);
export const deleteProject = (id) => request('DELETE', `/projects/${id}`);

export const getChapters = (projectId) => request('GET', `/projects/${projectId}/chapters`);
export const createChapter = (projectId, data) => request('POST', `/projects/${projectId}/chapters`, data);
export const getChapter = (id) => request('GET', `/chapters/${id}`);
export const updateChapter = (id, data) => request('PUT', `/chapters/${id}`, data);
export const deleteChapter = (id) => request('DELETE', `/chapters/${id}`);

export const getCharacters = (projectId) => request('GET', `/projects/${projectId}/characters`);
export const createCharacter = (projectId, data) => request('POST', `/projects/${projectId}/characters`, data);
export const updateCharacter = (id, data) => request('PUT', `/characters/${id}`, data);
export const deleteCharacter = (id) => request('DELETE', `/characters/${id}`);

export const getPlaces = (projectId) => request('GET', `/projects/${projectId}/places`);
export const createPlace = (projectId, data) => request('POST', `/projects/${projectId}/places`, data);
export const updatePlace = (id, data) => request('PUT', `/places/${id}`, data);
export const deletePlace = (id) => request('DELETE', `/places/${id}`);

export const aiAction = (data) => request('POST', '/ai', data);
