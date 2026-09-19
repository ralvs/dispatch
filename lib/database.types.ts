export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
	// Allows to automatically instantiate createClient with right options
	// instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
	__InternalSupabase: {
		PostgrestVersion: "14.5";
	};
	public: {
		Tables: {
			app_settings: {
				Row: {
					id: boolean;
					reminder_anchor_time: string;
					reminder_offset_minutes: number;
					timezone: string;
					updated_at: string;
				};
				Insert: {
					id?: boolean;
					reminder_anchor_time?: string;
					reminder_offset_minutes?: number;
					timezone?: string;
					updated_at?: string;
				};
				Update: {
					id?: boolean;
					reminder_anchor_time?: string;
					reminder_offset_minutes?: number;
					timezone?: string;
					updated_at?: string;
				};
				Relationships: [];
			};
			caldav_sync_state: {
				Row: {
					id: boolean;
					last_result: Json | null;
					last_synced_at: string | null;
				};
				Insert: {
					id?: boolean;
					last_result?: Json | null;
					last_synced_at?: string | null;
				};
				Update: {
					id?: boolean;
					last_result?: Json | null;
					last_synced_at?: string | null;
				};
				Relationships: [];
			};
			calendar_events: {
				Row: {
					all_day: boolean;
					attendees: Json;
					caldav_etag: string | null;
					caldav_href: string | null;
					caldav_uid: string | null;
					calendar_name: string | null;
					created_at: string;
					description: string | null;
					end_at: string;
					id: string;
					location: string | null;
					source: string;
					start_at: string;
					synced_at: string;
					title: string;
					updated_at: string;
				};
				Insert: {
					all_day?: boolean;
					attendees?: Json;
					caldav_etag?: string | null;
					caldav_href?: string | null;
					caldav_uid?: string | null;
					calendar_name?: string | null;
					created_at?: string;
					description?: string | null;
					end_at: string;
					id?: string;
					location?: string | null;
					source?: string;
					start_at: string;
					synced_at?: string;
					title: string;
					updated_at?: string;
				};
				Update: {
					all_day?: boolean;
					attendees?: Json;
					caldav_etag?: string | null;
					caldav_href?: string | null;
					caldav_uid?: string | null;
					calendar_name?: string | null;
					created_at?: string;
					description?: string | null;
					end_at?: string;
					id?: string;
					location?: string | null;
					source?: string;
					start_at?: string;
					synced_at?: string;
					title?: string;
					updated_at?: string;
				};
				Relationships: [];
			};
			captured_data: {
				Row: {
					created_at: string;
					display_hint: string;
					id: string;
					payload: Json;
					processed_status: string;
					source: string;
					source_ref: string | null;
					tags: string[];
					type: string;
				};
				Insert: {
					created_at?: string;
					display_hint?: string;
					id?: string;
					payload?: Json;
					processed_status?: string;
					source: string;
					source_ref?: string | null;
					tags?: string[];
					type: string;
				};
				Update: {
					created_at?: string;
					display_hint?: string;
					id?: string;
					payload?: Json;
					processed_status?: string;
					source?: string;
					source_ref?: string | null;
					tags?: string[];
					type?: string;
				};
				Relationships: [];
			};
			google_sync_state: {
				Row: {
					id: boolean;
					last_result: Json | null;
					last_synced_at: string | null;
				};
				Insert: {
					id?: boolean;
					last_result?: Json | null;
					last_synced_at?: string | null;
				};
				Update: {
					id?: boolean;
					last_result?: Json | null;
					last_synced_at?: string | null;
				};
				Relationships: [];
			};
			ingest_links: {
				Row: {
					created_at: string;
					description: string | null;
					id: string;
					source: string | null;
					status: string;
					title: string | null;
					updated_at: string;
					url: string;
				};
				Insert: {
					created_at?: string;
					description?: string | null;
					id?: string;
					source?: string | null;
					status?: string;
					title?: string | null;
					updated_at?: string;
					url: string;
				};
				Update: {
					created_at?: string;
					description?: string | null;
					id?: string;
					source?: string | null;
					status?: string;
					title?: string | null;
					updated_at?: string;
					url?: string;
				};
				Relationships: [];
			};
			journal_books: {
				Row: {
					book_number: number;
					created_at: string;
					end_date: string | null;
					id: string;
					notes: string | null;
					start_date: string | null;
				};
				Insert: {
					book_number: number;
					created_at?: string;
					end_date?: string | null;
					id?: string;
					notes?: string | null;
					start_date?: string | null;
				};
				Update: {
					book_number?: number;
					created_at?: string;
					end_date?: string | null;
					id?: string;
					notes?: string | null;
					start_date?: string | null;
				};
				Relationships: [];
			};
			journal_entries: {
				Row: {
					attachments: Json;
					book_id: string | null;
					created_at: string;
					entry_date: string;
					extracted_facts: Json;
					id: string;
					image_path: string | null;
					resurface_weight: number;
					source: string;
					tags: string[];
					transcription_text: string | null;
				};
				Insert: {
					attachments?: Json;
					book_id?: string | null;
					created_at?: string;
					entry_date: string;
					extracted_facts?: Json;
					id?: string;
					image_path?: string | null;
					resurface_weight?: number;
					source?: string;
					tags?: string[];
					transcription_text?: string | null;
				};
				Update: {
					attachments?: Json;
					book_id?: string | null;
					created_at?: string;
					entry_date?: string;
					extracted_facts?: Json;
					id?: string;
					image_path?: string | null;
					resurface_weight?: number;
					source?: string;
					tags?: string[];
					transcription_text?: string | null;
				};
				Relationships: [
					{
						foreignKeyName: "journal_entries_book_id_fkey";
						columns: ["book_id"];
						isOneToOne: false;
						referencedRelation: "journal_books";
						referencedColumns: ["id"];
					},
				];
			};
			mentions: {
				Row: {
					created_at: string;
					id: string;
					matched_name: string;
					note_id: string | null;
					person_id: string;
					source_type: string;
					task_id: string | null;
				};
				Insert: {
					created_at?: string;
					id?: string;
					matched_name: string;
					note_id?: string | null;
					person_id: string;
					source_type: string;
					task_id?: string | null;
				};
				Update: {
					created_at?: string;
					id?: string;
					matched_name?: string;
					note_id?: string | null;
					person_id?: string;
					source_type?: string;
					task_id?: string | null;
				};
				Relationships: [
					{
						foreignKeyName: "mentions_note_id_fkey";
						columns: ["note_id"];
						isOneToOne: false;
						referencedRelation: "notes";
						referencedColumns: ["id"];
					},
					{
						foreignKeyName: "mentions_person_id_fkey";
						columns: ["person_id"];
						isOneToOne: false;
						referencedRelation: "people";
						referencedColumns: ["id"];
					},
					{
						foreignKeyName: "mentions_task_id_fkey";
						columns: ["task_id"];
						isOneToOne: false;
						referencedRelation: "tasks";
						referencedColumns: ["id"];
					},
				];
			};
			note_links: {
				Row: {
					created_at: string;
					id: string;
					kind: string;
					note_id: string;
					target_event_id: string | null;
					target_note_id: string | null;
					target_task_id: string | null;
					target_type: string;
				};
				Insert: {
					created_at?: string;
					id?: string;
					kind?: string;
					note_id: string;
					target_event_id?: string | null;
					target_note_id?: string | null;
					target_task_id?: string | null;
					target_type: string;
				};
				Update: {
					created_at?: string;
					id?: string;
					kind?: string;
					note_id?: string;
					target_event_id?: string | null;
					target_note_id?: string | null;
					target_task_id?: string | null;
					target_type?: string;
				};
				Relationships: [
					{
						foreignKeyName: "note_links_note_id_fkey";
						columns: ["note_id"];
						isOneToOne: false;
						referencedRelation: "notes";
						referencedColumns: ["id"];
					},
					{
						foreignKeyName: "note_links_target_event_id_fkey";
						columns: ["target_event_id"];
						isOneToOne: false;
						referencedRelation: "calendar_events";
						referencedColumns: ["id"];
					},
					{
						foreignKeyName: "note_links_target_note_id_fkey";
						columns: ["target_note_id"];
						isOneToOne: false;
						referencedRelation: "notes";
						referencedColumns: ["id"];
					},
					{
						foreignKeyName: "note_links_target_task_id_fkey";
						columns: ["target_task_id"];
						isOneToOne: false;
						referencedRelation: "tasks";
						referencedColumns: ["id"];
					},
				];
			};
			notes: {
				Row: {
					attachments: Json;
					body: string;
					created_at: string;
					domain_id: string | null;
					id: string;
					needs_review: boolean;
					origin_capture_id: string | null;
					pinned_at: string | null;
					related_person_id: string | null;
					related_project_id: string | null;
					related_quote_id: string | null;
					resurface_weight: number;
					source_reference: string | null;
					source_type: string;
					tags: string[];
					title: string | null;
					updated_at: string;
				};
				Insert: {
					attachments?: Json;
					body: string;
					created_at?: string;
					domain_id?: string | null;
					id?: string;
					needs_review?: boolean;
					origin_capture_id?: string | null;
					pinned_at?: string | null;
					related_person_id?: string | null;
					related_project_id?: string | null;
					related_quote_id?: string | null;
					resurface_weight?: number;
					source_reference?: string | null;
					source_type?: string;
					tags?: string[];
					title?: string | null;
					updated_at?: string;
				};
				Update: {
					attachments?: Json;
					body?: string;
					created_at?: string;
					domain_id?: string | null;
					id?: string;
					needs_review?: boolean;
					origin_capture_id?: string | null;
					pinned_at?: string | null;
					related_person_id?: string | null;
					related_project_id?: string | null;
					related_quote_id?: string | null;
					resurface_weight?: number;
					source_reference?: string | null;
					source_type?: string;
					tags?: string[];
					title?: string | null;
					updated_at?: string;
				};
				Relationships: [
					{
						foreignKeyName: "notes_domain_id_fkey";
						columns: ["domain_id"];
						isOneToOne: false;
						referencedRelation: "stewardship_domains";
						referencedColumns: ["id"];
					},
					{
						foreignKeyName: "notes_origin_capture_id_fkey";
						columns: ["origin_capture_id"];
						isOneToOne: false;
						referencedRelation: "captured_data";
						referencedColumns: ["id"];
					},
					{
						foreignKeyName: "notes_related_person_id_fkey";
						columns: ["related_person_id"];
						isOneToOne: false;
						referencedRelation: "people";
						referencedColumns: ["id"];
					},
					{
						foreignKeyName: "notes_related_project_id_fkey";
						columns: ["related_project_id"];
						isOneToOne: false;
						referencedRelation: "projects";
						referencedColumns: ["id"];
					},
					{
						foreignKeyName: "notes_related_quote_id_fkey";
						columns: ["related_quote_id"];
						isOneToOne: false;
						referencedRelation: "quotes";
						referencedColumns: ["id"];
					},
				];
			};
			notifications: {
				Row: {
					body: string | null;
					created_at: string;
					id: string;
					source_ref: string | null;
					source_url: string | null;
					status: string;
					title: string;
					type: string;
					undo_payload: Json | null;
				};
				Insert: {
					body?: string | null;
					created_at?: string;
					id?: string;
					source_ref?: string | null;
					source_url?: string | null;
					status?: string;
					title: string;
					type: string;
					undo_payload?: Json | null;
				};
				Update: {
					body?: string | null;
					created_at?: string;
					id?: string;
					source_ref?: string | null;
					source_url?: string | null;
					status?: string;
					title?: string;
					type?: string;
					undo_payload?: Json | null;
				};
				Relationships: [];
			};
			observations: {
				Row: {
					acted_on: boolean;
					body: string | null;
					dismissed_at: string | null;
					domain_id: string | null;
					id: string;
					project_id: string | null;
					severity: string;
					supporting_data: Json;
					surfaced_at: string;
					title: string;
					type: string;
				};
				Insert: {
					acted_on?: boolean;
					body?: string | null;
					dismissed_at?: string | null;
					domain_id?: string | null;
					id?: string;
					project_id?: string | null;
					severity?: string;
					supporting_data?: Json;
					surfaced_at?: string;
					title: string;
					type: string;
				};
				Update: {
					acted_on?: boolean;
					body?: string | null;
					dismissed_at?: string | null;
					domain_id?: string | null;
					id?: string;
					project_id?: string | null;
					severity?: string;
					supporting_data?: Json;
					surfaced_at?: string;
					title?: string;
					type?: string;
				};
				Relationships: [
					{
						foreignKeyName: "observations_domain_id_fkey";
						columns: ["domain_id"];
						isOneToOne: false;
						referencedRelation: "stewardship_domains";
						referencedColumns: ["id"];
					},
					{
						foreignKeyName: "observations_project_id_fkey";
						columns: ["project_id"];
						isOneToOne: false;
						referencedRelation: "projects";
						referencedColumns: ["id"];
					},
				];
			};
			people: {
				Row: {
					company: string | null;
					created_at: string;
					email: string | null;
					id: string;
					name: string;
					notes: string | null;
					phone: string | null;
					relationship_type: string | null;
					updated_at: string;
				};
				Insert: {
					company?: string | null;
					created_at?: string;
					email?: string | null;
					id?: string;
					name: string;
					notes?: string | null;
					phone?: string | null;
					relationship_type?: string | null;
					updated_at?: string;
				};
				Update: {
					company?: string | null;
					created_at?: string;
					email?: string | null;
					id?: string;
					name?: string;
					notes?: string | null;
					phone?: string | null;
					relationship_type?: string | null;
					updated_at?: string;
				};
				Relationships: [];
			};
			person_facts: {
				Row: {
					created_at: string;
					date_relevant: string | null;
					fact_type: string;
					fact_value: string;
					id: string;
					person_id: string;
					recurring: boolean;
					source_ref: string | null;
				};
				Insert: {
					created_at?: string;
					date_relevant?: string | null;
					fact_type: string;
					fact_value: string;
					id?: string;
					person_id: string;
					recurring?: boolean;
					source_ref?: string | null;
				};
				Update: {
					created_at?: string;
					date_relevant?: string | null;
					fact_type?: string;
					fact_value?: string;
					id?: string;
					person_id?: string;
					recurring?: boolean;
					source_ref?: string | null;
				};
				Relationships: [
					{
						foreignKeyName: "person_facts_person_id_fkey";
						columns: ["person_id"];
						isOneToOne: false;
						referencedRelation: "people";
						referencedColumns: ["id"];
					},
				];
			};
			person_interactions: {
				Row: {
					id: string;
					interaction_type: string;
					notes: string | null;
					occurred_at: string;
					person_id: string;
				};
				Insert: {
					id?: string;
					interaction_type: string;
					notes?: string | null;
					occurred_at?: string;
					person_id: string;
				};
				Update: {
					id?: string;
					interaction_type?: string;
					notes?: string | null;
					occurred_at?: string;
					person_id?: string;
				};
				Relationships: [
					{
						foreignKeyName: "person_interactions_person_id_fkey";
						columns: ["person_id"];
						isOneToOne: false;
						referencedRelation: "people";
						referencedColumns: ["id"];
					},
				];
			};
			projects: {
				Row: {
					color: string | null;
					completed_at: string | null;
					created_at: string;
					description: string | null;
					domain_id: string;
					id: string;
					name: string;
					start_date: string | null;
					status: string;
					target_date: string | null;
					updated_at: string;
				};
				Insert: {
					color?: string | null;
					completed_at?: string | null;
					created_at?: string;
					description?: string | null;
					domain_id: string;
					id?: string;
					name: string;
					start_date?: string | null;
					status?: string;
					target_date?: string | null;
					updated_at?: string;
				};
				Update: {
					color?: string | null;
					completed_at?: string | null;
					created_at?: string;
					description?: string | null;
					domain_id?: string;
					id?: string;
					name?: string;
					start_date?: string | null;
					status?: string;
					target_date?: string | null;
					updated_at?: string;
				};
				Relationships: [
					{
						foreignKeyName: "projects_domain_id_fkey";
						columns: ["domain_id"];
						isOneToOne: false;
						referencedRelation: "stewardship_domains";
						referencedColumns: ["id"];
					},
				];
			};
			push_subscriptions: {
				Row: {
					created_at: string;
					endpoint: string;
					id: string;
					keys: Json;
				};
				Insert: {
					created_at?: string;
					endpoint: string;
					id?: string;
					keys: Json;
				};
				Update: {
					created_at?: string;
					endpoint?: string;
					id?: string;
					keys?: Json;
				};
				Relationships: [];
			};
			quote_annotations: {
				Row: {
					annotated_at: string;
					body: string;
					context: string | null;
					created_at: string;
					id: string;
					quote_id: string;
					tags: string[];
					updated_at: string;
				};
				Insert: {
					annotated_at?: string;
					body: string;
					context?: string | null;
					created_at?: string;
					id?: string;
					quote_id: string;
					tags?: string[];
					updated_at?: string;
				};
				Update: {
					annotated_at?: string;
					body?: string;
					context?: string | null;
					created_at?: string;
					id?: string;
					quote_id?: string;
					tags?: string[];
					updated_at?: string;
				};
				Relationships: [
					{
						foreignKeyName: "quote_annotations_quote_id_fkey";
						columns: ["quote_id"];
						isOneToOne: false;
						referencedRelation: "quotes";
						referencedColumns: ["id"];
					},
				];
			};
			quotes: {
				Row: {
					added_via: string;
					chapter: string | null;
					created_at: string;
					id: string;
					last_surfaced_at: string | null;
					page_number: number | null;
					resurface_weight: number;
					source_author: string | null;
					source_reference: string | null;
					source_type: string | null;
					source_url: string | null;
					tags: string[];
					text: string;
				};
				Insert: {
					added_via?: string;
					chapter?: string | null;
					created_at?: string;
					id?: string;
					last_surfaced_at?: string | null;
					page_number?: number | null;
					resurface_weight?: number;
					source_author?: string | null;
					source_reference?: string | null;
					source_type?: string | null;
					source_url?: string | null;
					tags?: string[];
					text: string;
				};
				Update: {
					added_via?: string;
					chapter?: string | null;
					created_at?: string;
					id?: string;
					last_surfaced_at?: string | null;
					page_number?: number | null;
					resurface_weight?: number;
					source_author?: string | null;
					source_reference?: string | null;
					source_type?: string | null;
					source_url?: string | null;
					tags?: string[];
					text?: string;
				};
				Relationships: [];
			};
			resurfacing_seen: {
				Row: {
					id: string;
					item_id: string;
					item_type: string;
					surfaced_on: string;
					user_response: string | null;
				};
				Insert: {
					id?: string;
					item_id: string;
					item_type: string;
					surfaced_on?: string;
					user_response?: string | null;
				};
				Update: {
					id?: string;
					item_id?: string;
					item_type?: string;
					surfaced_on?: string;
					user_response?: string | null;
				};
				Relationships: [];
			};
			routine_completions: {
				Row: {
					completed_date: string;
					created_at: string;
					id: string;
					routine_id: string;
				};
				Insert: {
					completed_date: string;
					created_at?: string;
					id?: string;
					routine_id: string;
				};
				Update: {
					completed_date?: string;
					created_at?: string;
					id?: string;
					routine_id?: string;
				};
				Relationships: [
					{
						foreignKeyName: "routine_completions_routine_id_fkey";
						columns: ["routine_id"];
						isOneToOne: false;
						referencedRelation: "routines";
						referencedColumns: ["id"];
					},
				];
			};
			routines: {
				Row: {
					active: boolean;
					archived_at: string | null;
					created_at: string;
					description: string | null;
					goal_days: number | null;
					id: string;
					last_missed_sent_date: string | null;
					last_reminder_sent_date: string | null;
					name: string;
					position: number;
					reminder_enabled: boolean;
					specific_time: string | null;
					time_of_day: string;
					updated_at: string;
				};
				Insert: {
					active?: boolean;
					archived_at?: string | null;
					created_at?: string;
					description?: string | null;
					goal_days?: number | null;
					id?: string;
					last_missed_sent_date?: string | null;
					last_reminder_sent_date?: string | null;
					name: string;
					position?: number;
					reminder_enabled?: boolean;
					specific_time?: string | null;
					time_of_day?: string;
					updated_at?: string;
				};
				Update: {
					active?: boolean;
					archived_at?: string | null;
					created_at?: string;
					description?: string | null;
					goal_days?: number | null;
					id?: string;
					last_missed_sent_date?: string | null;
					last_reminder_sent_date?: string | null;
					name?: string;
					position?: number;
					reminder_enabled?: boolean;
					specific_time?: string | null;
					time_of_day?: string;
					updated_at?: string;
				};
				Relationships: [];
			};
			stewardship_domains: {
				Row: {
					active: boolean;
					color: string | null;
					created_at: string;
					description: string | null;
					expected_cadence: string | null;
					failure_patterns: Json;
					fruit_definition: string | null;
					id: string;
					last_shipped_at: string | null;
					name: string;
					updated_at: string;
				};
				Insert: {
					active?: boolean;
					color?: string | null;
					created_at?: string;
					description?: string | null;
					expected_cadence?: string | null;
					failure_patterns?: Json;
					fruit_definition?: string | null;
					id?: string;
					last_shipped_at?: string | null;
					name: string;
					updated_at?: string;
				};
				Update: {
					active?: boolean;
					color?: string | null;
					created_at?: string;
					description?: string | null;
					expected_cadence?: string | null;
					failure_patterns?: Json;
					fruit_definition?: string | null;
					id?: string;
					last_shipped_at?: string | null;
					name?: string;
					updated_at?: string;
				};
				Relationships: [];
			};
			tasks: {
				Row: {
					completed_at: string | null;
					created_at: string;
					domain_id: string | null;
					due_date: string | null;
					due_time: string | null;
					id: string;
					notes: string | null;
					priority: number;
					project_id: string | null;
					recurrence_rule: string | null;
					reminder_offsets: Json;
					reminders_sent: Json;
					source: string;
					status: string;
					title: string;
					top3_for_date: string | null;
					updated_at: string;
				};
				Insert: {
					completed_at?: string | null;
					created_at?: string;
					domain_id?: string | null;
					due_date?: string | null;
					due_time?: string | null;
					id?: string;
					notes?: string | null;
					priority?: number;
					project_id?: string | null;
					recurrence_rule?: string | null;
					reminder_offsets?: Json;
					reminders_sent?: Json;
					source?: string;
					status?: string;
					title: string;
					top3_for_date?: string | null;
					updated_at?: string;
				};
				Update: {
					completed_at?: string | null;
					created_at?: string;
					domain_id?: string | null;
					due_date?: string | null;
					due_time?: string | null;
					id?: string;
					notes?: string | null;
					priority?: number;
					project_id?: string | null;
					recurrence_rule?: string | null;
					reminder_offsets?: Json;
					reminders_sent?: Json;
					source?: string;
					status?: string;
					title?: string;
					top3_for_date?: string | null;
					updated_at?: string;
				};
				Relationships: [
					{
						foreignKeyName: "tasks_domain_id_fkey";
						columns: ["domain_id"];
						isOneToOne: false;
						referencedRelation: "stewardship_domains";
						referencedColumns: ["id"];
					},
					{
						foreignKeyName: "tasks_project_id_fkey";
						columns: ["project_id"];
						isOneToOne: false;
						referencedRelation: "projects";
						referencedColumns: ["id"];
					},
				];
			};
		};
		Views: {
			[_ in never]: never;
		};
		Functions: {
			note_attachment_add: {
				Args: { p_item: Json; p_note_id: string };
				Returns: undefined;
			};
			note_attachment_remove: {
				Args: { p_note_id: string; p_storage_path: string };
				Returns: undefined;
			};
		};
		Enums: {
			[_ in never]: never;
		};
		CompositeTypes: {
			[_ in never]: never;
		};
	};
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
	DefaultSchemaTableNameOrOptions extends
		| keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
		| { schema: keyof DatabaseWithoutInternals },
	TableName extends DefaultSchemaTableNameOrOptions extends {
		schema: keyof DatabaseWithoutInternals;
	}
		? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
				DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
		: never = never,
> = DefaultSchemaTableNameOrOptions extends {
	schema: keyof DatabaseWithoutInternals;
}
	? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
			DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
			Row: infer R;
		}
		? R
		: never
	: DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
		? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
				Row: infer R;
			}
			? R
			: never
		: never;

export type TablesInsert<
	DefaultSchemaTableNameOrOptions extends
		| keyof DefaultSchema["Tables"]
		| { schema: keyof DatabaseWithoutInternals },
	TableName extends DefaultSchemaTableNameOrOptions extends {
		schema: keyof DatabaseWithoutInternals;
	}
		? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
		: never = never,
> = DefaultSchemaTableNameOrOptions extends {
	schema: keyof DatabaseWithoutInternals;
}
	? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
			Insert: infer I;
		}
		? I
		: never
	: DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
		? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
				Insert: infer I;
			}
			? I
			: never
		: never;

export type TablesUpdate<
	DefaultSchemaTableNameOrOptions extends
		| keyof DefaultSchema["Tables"]
		| { schema: keyof DatabaseWithoutInternals },
	TableName extends DefaultSchemaTableNameOrOptions extends {
		schema: keyof DatabaseWithoutInternals;
	}
		? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
		: never = never,
> = DefaultSchemaTableNameOrOptions extends {
	schema: keyof DatabaseWithoutInternals;
}
	? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
			Update: infer U;
		}
		? U
		: never
	: DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
		? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
				Update: infer U;
			}
			? U
			: never
		: never;

export type Enums<
	DefaultSchemaEnumNameOrOptions extends
		| keyof DefaultSchema["Enums"]
		| { schema: keyof DatabaseWithoutInternals },
	EnumName extends DefaultSchemaEnumNameOrOptions extends {
		schema: keyof DatabaseWithoutInternals;
	}
		? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
		: never = never,
> = DefaultSchemaEnumNameOrOptions extends {
	schema: keyof DatabaseWithoutInternals;
}
	? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
	: DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
		? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
		: never;

export type CompositeTypes<
	PublicCompositeTypeNameOrOptions extends
		| keyof DefaultSchema["CompositeTypes"]
		| { schema: keyof DatabaseWithoutInternals },
	CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
		schema: keyof DatabaseWithoutInternals;
	}
		? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
		: never = never,
> = PublicCompositeTypeNameOrOptions extends {
	schema: keyof DatabaseWithoutInternals;
}
	? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
	: PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
		? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
		: never;

export const Constants = {
	public: {
		Enums: {},
	},
} as const;
