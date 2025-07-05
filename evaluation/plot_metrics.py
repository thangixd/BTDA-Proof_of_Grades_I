import json
import pandas as pd
import matplotlib.pyplot as plt
import seaborn as sns
import os
import sys
import glob

def load_metrics_from_json(file_path):
    with open(file_path, 'r') as f:
        data = json.load(f)

    base_name = os.path.basename(os.path.dirname(file_path))
    formatted_name = base_name.replace('metrics_', '').replace('_', ' ').title()
    flat_metrics = {'Approach': formatted_name}
    
    metrics_data = data.get('metrics', {})

    # Performance Metrics
    perf_stages = ['compilation', 'witnessGeneration', 'groth16Setup', 'zkeyContribute', 'proofGeneration', 'proofVerification']
    for stage in perf_stages:
        stage_data = metrics_data.get(stage, {})
        if 'timeMs' in stage_data:
            flat_metrics[f'Time ({stage})'] = stage_data['timeMs']
        if 'maxMemoryBytes' in stage_data:
            flat_metrics[f'Max Memory ({stage}) (MB)'] = stage_data['maxMemoryBytes'] / (1024 * 1024)
        if 'maxCpuPercent' in stage_data:
            flat_metrics[f'Max CPU ({stage}) (%)'] = stage_data['maxCpuPercent']

    # Circuit Details
    if 'circuitDetails' in metrics_data:
        details_to_keep = {
            'template_instances': 'Circuit: Template Instances',
            'non-linear_constraints': 'Circuit: Non-Linear Constraints',
            'linear_constraints': 'Circuit: Linear Constraints',
            'wires': 'Circuit: Wires'
        }
        for detail_key, title in details_to_keep.items():
            if detail_key in metrics_data['circuitDetails']:
                flat_metrics[title] = metrics_data['circuitDetails'][detail_key]

    if 'witnessGeneration' in metrics_data and 'fileSizeWitnessBytes' in metrics_data['witnessGeneration']:
        flat_metrics['File Size: Witness (MB)'] = metrics_data['witnessGeneration']['fileSizeWitnessBytes'] / (1024 * 1024)
    if 'groth16Setup' in metrics_data and 'fileSizeZkey0000Bytes' in metrics_data['groth16Setup']:
        flat_metrics['File Size: Zkey 0000 (MB)'] = metrics_data['groth16Setup']['fileSizeZkey0000Bytes'] / (1024 * 1024)
    if 'zkeyContribute' in metrics_data and 'fileSizeZkey0001Bytes' in metrics_data['zkeyContribute']:
        flat_metrics['File Size: Zkey 0001 (MB)'] = metrics_data['zkeyContribute']['fileSizeZkey0001Bytes'] / (1024 * 1024)

    return flat_metrics

def load_and_process_directory(directory_path):
    print(f"Processing directory: {directory_path}")
    json_pattern = os.path.join(directory_path, 'metrics_run_*.json')
    json_files = glob.glob(json_pattern)

    if not json_files:
        print(f"Warning: No metric files found in {directory_path}. Skipping.")
        return None

    all_metrics_data = [load_metrics_from_json(f_path) for f_path in json_files]
    df_approach = pd.DataFrame(all_metrics_data)
    formatted_name = df_approach['Approach'].iloc[0] 
    mean_metrics = df_approach.select_dtypes(include='number').mean()
    mean_metrics['Approach'] = formatted_name
    
    return mean_metrics

def plot_metrics(df, metrics_type, title_prefix, ylabel, filename_prefix):
    columns_to_plot = [col for col in df.columns if metrics_type in col]
    
    if not columns_to_plot:
        print(f"No columns found for '{metrics_type}'. Skipping plot.")
        return

    df_melted = df[['Approach'] + columns_to_plot].melt(id_vars='Approach', var_name='Metric', value_name='Value')
    
    plt.figure(figsize=(14, 8))
    sns.barplot(x='Metric', y='Value', hue='Approach', data=df_melted, palette='viridis')
    
    plt.title(f'{title_prefix} Comparison (Mean of 10 Runs)', fontsize=16, pad=20)
    plt.xlabel('Metric', fontsize=12)
    plt.ylabel(ylabel, fontsize=12)
    plt.xticks(rotation=45, ha='right', fontsize=10)
    plt.yticks(fontsize=10)
    plt.legend(title='Approach', fontsize=10, title_fontsize=12)
    plt.grid(axis='y', linestyle='--', alpha=0.7)
    plt.tight_layout()
    
    output_filename = f'results/{filename_prefix}_comparison.png'
    plt.savefig(output_filename)
    plt.close()
    print(f"Generated {output_filename}")

def main():
    if len(sys.argv) != 3:
        print("Usage: python plot_metrics.py <path_to_directory_1> <path_to_directory_2>")
        sys.exit(1)

    dir_paths = sys.argv[1:]
    aggregated_data = []

    for d_path in dir_paths:
        if not os.path.isdir(d_path):
            print(f"Error: Directory not found - {d_path}")
            continue
        
        mean_results = load_and_process_directory(d_path)
        if mean_results is not None:
            aggregated_data.append(mean_results)

    if len(aggregated_data) < 2:
        print("Could not process at least two directories. Exiting.")
        sys.exit(1)

    df_final = pd.DataFrame(aggregated_data)
    cols = ['Approach'] + [col for col in df_final.columns if col != 'Approach']
    df_final = df_final[cols]
    
    print("\nGenerating plots based on mean values...")
    plot_metrics(df_final, 'Time (', 'Execution Time', 'Time (ms)', 'execution_time')
    plot_metrics(df_final, 'Max Memory (', 'Peak Memory Usage', 'Memory (MB)', 'peak_memory')
    plot_metrics(df_final, 'Max CPU (', 'Peak CPU Usage', 'CPU (%)', 'peak_cpu')
    plot_metrics(df_final, 'Circuit:', 'Circuit Details', 'Count', 'circuit_details')
    plot_metrics(df_final, 'File Size:', 'Artifact File Sizes', 'Size (MB)', 'artifact_sizes')
    
    print("\nAll plots generated successfully!")

if __name__ == "__main__":

    if not os.path.exists('results'):
        os.makedirs('results')

    main()
