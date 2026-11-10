import { isPlayableAudio } from '../api/dawahPublicService.js'
import AudioPlayer from './AudioPlayer.jsx'

/** Player for a ready published audio resource; anything else is explicitly unavailable. */
export default function PlayableResource({ resource }) {
  if (resource.type !== 'aud') {
    return <p className="text-sm text-[#6B7280] dark:text-gray-300">This type of content is not available to play here yet.</p>
  }
  if (!isPlayableAudio(resource)) {
    return (
      <p role="status" className="text-sm text-[#6B7280] dark:text-gray-300">
        This audio is not available right now.
      </p>
    )
  }
  return <AudioPlayer key={resource.mediaUrl} src={resource.mediaUrl} title={resource.title} durationHint={resource.duration} />
}
