export type Mood = { id: string; label: string; emoji: string; color: string; sort: number };

export type Profile = {
  id: string;
  username: string;
  avatar: string;
  bio: string;
  current_mood: string | null;
  show_mood: boolean;
  show_communities: boolean;
  allow_dm_requests: boolean;
  is_premium: boolean;
  premium_until: string | null;
  is_admin: boolean;
  status: 'active' | 'suspended' | 'banned';
  suspended_until: string | null;
  created_at: string;
};

export type Community = {
  id: string;
  name: string;
  description: string;
  emoji: string;
  mood_id: string;
  is_active: boolean;
  member_count: number;
  created_at: string;
};

export type FeedPost = {
  id: string;
  community_id: string;
  body: string;
  mood_id: string | null;
  is_anonymous: boolean;
  comment_count: number;
  reaction_count: number;
  created_at: string;
  author_id: string | null;
  author_name: string;
  author_avatar: string;
  author_premium: boolean;
  is_mine: boolean;
  community_name: string;
  community_emoji: string;
  my_reaction: string | null;
};

export type FeedComment = {
  id: string;
  post_id: string;
  body: string;
  is_anonymous: boolean;
  created_at: string;
  author_id: string | null;
  author_name: string;
  author_avatar: string;
  is_mine: boolean;
};

export type ChatMessage = {
  id: string;
  community_id: string;
  body: string;
  created_at: string;
  user_id: string;
  author_name: string;
  author_avatar: string;
  author_premium: boolean;
};

export type Notification = {
  id: string;
  type: string;
  title: string;
  body: string;
  data: Record<string, string>;
  is_read: boolean;
  created_at: string;
};

export type Thread = {
  id: string;
  last_message_at: string;
  other_id: string;
  other_name: string;
  other_avatar: string;
  other_premium: boolean;
  last_message: string | null;
};
