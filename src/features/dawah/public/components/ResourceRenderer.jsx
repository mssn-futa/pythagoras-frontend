import { Link } from 'react-router-dom'
import { isAvailableDocument, isPlayableAudio, isPlayableVideo } from '../api/dawahPublicService.js'
import { safePublicUrl } from '../lib/safeUrl.js'
import AudioPlayer from './AudioPlayer.jsx'
import DocumentLink from './DocumentLink.jsx'
import VideoEmbed from './VideoEmbed.jsx'

const note = 'text-sm text-[#6B7280] dark:text-gray-300'

function Unavailable({ children }) {
  return (
    <p role="status" className={note}>
      {children}
    </p>
  )
}

/** In lists: one action per type (cards stay light; no players or frames per card). */
function Compact({ resource, detailPath }) {
  const link = 'font-medium text-[#2A742F] underline dark:text-green-400'
  if (resource.type === 'doc') {
    return isAvailableDocument(resource) ? <DocumentLink resource={resource} /> : <Unavailable>This document is not available right now.</Unavailable>
  }
  if (resource.type === 'aud' || resource.type === 'vid') {
    return detailPath ? (
      <Link to={detailPath} className={link}>
        {resource.type === 'vid' ? 'Watch' : 'Listen'}
      </Link>
    ) : null
  }
  return <Unavailable>This type of content is not available to view here.</Unavailable>
}

/**
 * Typed resource renderer (DAWAH-08), reusable by Arabic/learning modules.
 *
 * Props:
 *   resource   a public resource as returned by `mapResource` / `getResource` /
 *              `getEvent().resources[]` / `listArchive().results[]`:
 *              { id, title, type: 'aud'|'vid'|'doc', status, storageStatus, mediaUrl,
 *                duration, playback, fileName, contentType, sizeBytes }
 *   variant    'full' (default): audio player, YouTube embed + watch link, or document
 *              link; 'compact': for lists (Listen/Watch link, or the document link).
 *   detailPath compact only: where Listen/Watch go (e.g. `/dawah/content/${id}`).
 *
 * Everything is re-validated here: unpublished/not-ready/non-https/unsafe items render
 * an explicit "not available" message and never a player, frame or link.
 */
export default function ResourceRenderer({ resource, variant = 'full', detailPath }) {
  if (!resource) return null
  if (variant === 'compact') return <Compact resource={resource} detailPath={detailPath} />

  if (resource.type === 'vid') {
    return isPlayableVideo(resource) ? (
      <VideoEmbed playback={resource.playback} title={resource.title} />
    ) : (
      <Unavailable>This video is not available right now.</Unavailable>
    )
  }
  if (resource.type === 'doc') {
    return isAvailableDocument(resource) ? <DocumentLink resource={resource} /> : <Unavailable>This document is not available right now.</Unavailable>
  }
  if (resource.type === 'aud') {
    return isPlayableAudio(resource) ? (
      <AudioPlayer key={resource.mediaUrl} src={safePublicUrl(resource.mediaUrl)} title={resource.title} durationHint={resource.duration} />
    ) : (
      <Unavailable>This audio is not available right now.</Unavailable>
    )
  }
  return <p className={note}>This type of content is not available to view here.</p>
}
