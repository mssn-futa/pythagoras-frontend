// Public entry point for other modules (e.g. ASSESS-09 Arabic learning pages).
export { default as ResourceRenderer } from './components/ResourceRenderer.jsx'
export { default as DocumentLink } from './components/DocumentLink.jsx'
export { default as EventImage } from './components/EventImage.jsx'
export { mapResource, mapEvent, isAvailableDocument, isPlayableAudio, isPlayableVideo } from './api/dawahPublicService.js'
