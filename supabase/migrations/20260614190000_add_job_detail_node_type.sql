alter table public.canvas_nodes
  drop constraint if exists canvas_nodes_node_type_check;

alter table public.canvas_nodes
  add constraint canvas_nodes_node_type_check
  check (
    node_type in (
      'input',
      'persona',
      'recommended_jobs',
      'job_detail',
      'jd_request',
      'jd_analysis',
      'optimization_suggestions',
      'optimized_resume',
      'career_change_translation'
    )
  );
