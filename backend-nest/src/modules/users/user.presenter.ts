import { User } from './user.entity';

export function presentUser(user: User) {
  return {
    id: Number(user.id),
    email: user.email,
    username: user.username,
    display_name: user.display_name,
    first_name: user.first_name,
    last_name: user.last_name,
    avatar_url: user.avatar_url,
    home_airport: user.home_airport,
    preferred_currency: user.preferred_currency,
    is_profile_complete: user.is_profile_complete,
    created_at: user.created_at,
    updated_at: user.updated_at,
  };
}
