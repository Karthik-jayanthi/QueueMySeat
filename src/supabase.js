import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://qwzhushvwkzbbzvddlyp.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF3emh1c2h2d2t6YmJ6dmRkbHlwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc0NTAzNTIsImV4cCI6MjA5MzAyNjM1Mn0._ZSvT9UUsUXFAaN7phdahMoV_3fU9p5GUgMe_wZu8cA';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Save a booking to Supabase
export async function saveBooking(spotifyId, booking) {
  const { data, error } = await supabase
    .from('bookings')
    .insert({
      spotify_id: spotifyId,
      concert_id: booking.concert.id,
      artist: booking.concert.artist,
      concert_date: booking.concert.date,
      venue: booking.concert.venue,
      city: booking.concert.city,
      tickets: booking.tickets,
      total_price: booking.total,
      queue_position: booking.queuePos,
      fan_score: booking.fanScore,
      add_friends: booking.addFriends,
      extra_tickets: booking.extraTickets,
    })
    .select()
    .single();
  if (error) {
    console.error('saveBooking error:', error.message);
    throw error;
  }
  return data;
}

// Fetch all bookings for a Spotify user ID
export async function fetchBookings(spotifyId) {
  if (!spotifyId) return [];
  const { data, error } = await supabase
    .from('bookings')
    .select('*')
    .eq('spotify_id', spotifyId)
    .order('created_at', { ascending: false });
  if (error) {
    console.error('fetchBookings error:', error.message);
    return [];
  }
  return data || [];
}
export async function deleteBooking(id) {
  const { error } = await supabase
    .from('bookings')
    .delete()
    .eq('id', id);
  if (error) {
    console.error('deleteBooking error:', error.message);
    throw error;
  }
}
