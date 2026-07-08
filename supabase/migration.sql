-- Enable pgvector extension
create extension if not exists vector;

-- Users table (managed by Supabase Auth, extended here)
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  email text not null unique,
  bio text default '',
  avatar_url text default '',
  created_at timestamptz default now()
);

alter table public.profiles enable row level security;

create policy "Profiles are viewable by everyone"
  on public.profiles for select using (true);

create policy "Users can update own profile"
  on public.profiles for update using (auth.uid() = id);

-- Function to auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, name, email, avatar_url)
  values (new.id, coalesce(new.raw_user_meta_data->>'name', 'User'), new.email, '');
  return new;
end;
$$ language plpgsql security definer;

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Posts table (lost & found items)
create table public.posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade not null,
  type text not null check (type in ('lost', 'found')),
  description text not null,
  category text,
  location text,
  date text,
  image_url text default '',
  status text default 'active' check (status in ('active', 'resolved')),
  image_vector vector(512),
  text_vector vector(384),
  created_at timestamptz default now()
);

create index idx_posts_type on public.posts(type);
create index idx_posts_user on public.posts(user_id);
create index idx_posts_status on public.posts(status);
create index idx_posts_created on public.posts(created_at desc);

alter table public.posts enable row level security;

create policy "Posts are viewable by everyone"
  on public.posts for select using (true);

create policy "Users can insert own posts"
  on public.posts for insert with check (auth.uid() = user_id);

create policy "Users can update own posts"
  on public.posts for update using (auth.uid() = user_id);

create policy "Users can delete own posts"
  on public.posts for delete using (auth.uid() = user_id);

-- Likes table
create table public.likes (
  id uuid primary key default gen_random_uuid(),
  post_id uuid references public.posts(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  created_at timestamptz default now(),
  unique(post_id, user_id)
);

alter table public.likes enable row level security;

create policy "Likes are viewable by everyone"
  on public.likes for select using (true);

create policy "Users can toggle own likes"
  on public.likes for insert with check (auth.uid() = user_id);

create policy "Users can remove own likes"
  on public.likes for delete using (auth.uid() = user_id);

-- Comments table
create table public.comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid references public.posts(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  content text not null,
  created_at timestamptz default now()
);

alter table public.comments enable row level security;

create policy "Comments are viewable by everyone"
  on public.comments for select using (true);

create policy "Users can insert own comments"
  on public.comments for insert with check (auth.uid() = user_id);

create policy "Users can delete own comments"
  on public.comments for delete using (auth.uid() = user_id);

create index idx_comments_post on public.comments(post_id);

-- Matches table
create table public.matches (
  id uuid primary key default gen_random_uuid(),
  lost_post_id uuid references public.posts(id) on delete cascade not null,
  found_post_id uuid references public.posts(id) on delete cascade not null,
  confidence decimal(5,2) not null,
  lost_confirmed boolean default false,
  found_confirmed boolean default false,
  status text default 'pending' check (status in ('pending', 'confirmed', 'rejected')),
  created_at timestamptz default now(),
  unique(lost_post_id, found_post_id)
);

alter table public.matches enable row level security;

create policy "Matches visible to involved users"
  on public.matches for select using (
    auth.uid() in (
      select user_id from public.posts where id in (lost_post_id, found_post_id)
    )
  );

create policy "Involved users can update match status"
  on public.matches for update using (
    auth.uid() in (
      select user_id from public.posts where id in (lost_post_id, found_post_id)
    )
  );

-- Conversations table (DMs)
create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  user1_id uuid references public.profiles(id) on delete cascade not null,
  user2_id uuid references public.profiles(id) on delete cascade not null,
  created_at timestamptz default now(),
  unique(user1_id, user2_id)
);

alter table public.conversations enable row level security;

create policy "Conversations visible to participants"
  on public.conversations for select using (
    auth.uid() in (user1_id, user2_id)
  );

create policy "Users can create conversations"
  on public.conversations for insert with check (auth.uid() in (user1_id, user2_id));

-- Messages table
create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid references public.conversations(id) on delete cascade not null,
  sender_id uuid references public.profiles(id) on delete cascade not null,
  content text not null,
  created_at timestamptz default now()
);

create index idx_messages_conv on public.messages(conversation_id);

alter table public.messages enable row level security;

create policy "Messages visible to conversation participants"
  on public.messages for select using (
    exists (
      select 1 from public.conversations
      where id = messages.conversation_id
      and auth.uid() in (user1_id, user2_id)
    )
  );

create policy "Users can send messages"
  on public.messages for insert with check (auth.uid() = sender_id);

-- Enable real-time for posts table (needed for live delete propagation)
alter publication supabase_realtime add table posts;
