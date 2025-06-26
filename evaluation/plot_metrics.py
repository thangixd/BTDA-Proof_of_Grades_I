import json
import pandas as pd
import matplotlib.pyplot as plt
import seaborn as sns
import os
import sys

def load_metrics_from_json(file_path):
    """Loads metrics from a single JSON file and flattens them."""
    with open(file_path, 'r') as f:
        data = json.load(f)

    circuit_name = data.get('circuitName', os.path.basename(file_path).replace('metrics_', '').replace('.json', ''))
    flat_metrics = {'Approach': circuit_name}
    
    # Time metrics
    for stage in ['compilation', 'witnessGeneration', 'groth16Setup', 'zkeyContribute', 'proofGeneration', 'proofVerification']:
        if stage in data['metrics'] and 'timeMs' in data['metrics'][stage]:
            flat_metrics[f'Time ({stage})'] = data['metrics'][stage]['timeMs']

    # Memory metrics (convert bytes to MB)
    for stage in ['compilation', 'witnessGeneration', 'groth16Setup', 'zkeyContribute', 'proofGeneration', 'proofVerification']:
        if stage in data['metrics'] and 'maxMemoryBytes' in data['metrics'][stage]:
            flat_metrics[f'Max Memory ({stage}) (MB)'] = data['metrics'][stage]['maxMemoryBytes'] / (1024 * 1024)

    # CPU metrics
    for stage in ['compilation', 'witnessGeneration', 'groth16Setup', 'zkeyContribute', 'proofGeneration', 'proofVerification']:
        if stage in data['metrics'] and 'maxCpuPercent' in data['metrics'][stage]:
            flat_metrics[f'Max CPU ({stage}) (%)'] = data['metrics'][stage]['maxCpuPercent']
            
    if 'circuitDetails' in data['metrics']:
        for detail_key, value in data['metrics']['circuitDetails'].items():
            flat_metrics[f'Circuit: {detail_key.replace("_", " ").title()}'] = value

    if 'witnessGeneration' in data['metrics'] and 'fileSizeWitnessBytes' in data['metrics']['witnessGeneration']:
        flat_metrics['File Size: Witness (MB)'] = data['metrics']['witnessGeneration']['fileSizeWitnessBytes'] / (1024 * 1024)
    if 'groth16Setup' in data['metrics'] and 'fileSizeZkey0000Bytes' in data['metrics']['groth16Setup']:
        flat_metrics['File Size: Zkey 0000 (MB)'] = data['metrics']['groth16Setup']['fileSizeZkey0000Bytes'] / (1024 * 1024)
    if 'zkeyContribute' in data['metrics'] and 'fileSizeZkey0001Bytes' in data['metrics']['zkeyContribute']:
        flat_metrics['File Size: Zkey 0001 (MB)'] = data['metrics']['zkeyContribute']['fileSizeZkey0001Bytes'] / (1024 * 1024)
    if 'verificationKeyExport' in data['metrics'] and 'fileSizeVerificationKeyBytes' in data['metrics']['verificationKeyExport']:
        flat_metrics['File Size: Verification Key (KB)'] = data['metrics']['verificationKeyExport']['fileSizeVerificationKeyBytes'] / 1024
    if 'proofGeneration' in data['metrics'] and 'fileSizeProofBytes' in data['metrics']['proofGeneration']:
        flat_metrics['File Size: Proof (KB)'] = data['metrics']['proofGeneration']['fileSizeProofBytes'] / 1024
    if 'proofGeneration' in data['metrics'] and 'fileSizePublicInputsBytes' in data['metrics']['proofGeneration']:
        flat_metrics['File Size: Public Inputs (KB)'] = data['metrics']['proofGeneration']['fileSizePublicInputsBytes'] / 1024
    if 'solidityVerifierExport' in data['metrics'] and 'fileSizeSolidityVerifierBytes' in data['metrics']['solidityVerifierExport']:
        flat_metrics['File Size: Solidity Verifier (KB)'] = data['metrics']['solidityVerifierExport']['fileSizeSolidityVerifierBytes'] / 1024

    return flat_metrics

def plot_metrics(df, metrics_type, title_prefix, ylabel, filename_prefix):
    """Generates and saves grouped bar charts for a specific type of metric."""
    columns_to_plot = [col for col in df.columns if metrics_type in col and col != 'Approach']
    if filename_prefix == 'circuit_details':
        exclude_cols = [
            'Circuit: Public Inputs',
            'Circuit: Private Inputs Total',
            'Circuit: Private Inputs Witness',
            'Circuit: Public Outputs'
        ]
        columns_to_plot = [col for col in columns_to_plot if col not in exclude_cols]
    
    if not columns_to_plot:
        print(f"No columns found for {metrics_type}. Skipping plot.")
        return

    df_melted = df[['Approach'] + columns_to_plot].melt(id_vars='Approach', var_name='Metric', value_name='Value')
    
    plt.figure(figsize=(12, 7))
    sns.barplot(x='Metric', y='Value', hue='Approach', data=df_melted, palette='viridis')
    
    plt.title(f'{title_prefix} Comparison', fontsize=16)
    plt.xlabel('Metric', fontsize=12)
    plt.ylabel(ylabel, fontsize=12)
    plt.xticks(rotation=45, ha='right', fontsize=10)
    plt.yticks(fontsize=10)
    plt.legend(title='Approach', fontsize=10, title_fontsize=12)
    plt.tight_layout()
    plt.savefig(f'results/{filename_prefix}_comparison.png')
    plt.close()
    print(f"Generated {filename_prefix}_comparison.png")

def main():
    if len(sys.argv) < 2:
        print("Usage: python plot_metrics.py <path_to_metrics_json_1> <path_to_metrics_json_2> ...")
        sys.exit(1)

    json_files = sys.argv[1:]
    all_metrics_data = []

    for f_path in json_files:
        if not os.path.exists(f_path):
            print(f"Error: File not found - {f_path}")
            continue
        print(f"Loading metrics from: {f_path}")
        all_metrics_data.append(load_metrics_from_json(f_path))

    if not all_metrics_data:
        print("No valid metric files loaded. Exiting.")
        sys.exit(1)

    df = pd.DataFrame(all_metrics_data)

    cols = ['Approach'] + [col for col in df.columns if col != 'Approach']
    df = df[cols]
    
    plot_metrics(df, 'Time (', 'Execution Time', 'Time (ms)', 'execution_time')
    plot_metrics(df, 'Max Memory (', 'Peak Memory Usage', 'Memory (MB)', 'peak_memory')
    plot_metrics(df, 'Max CPU (', 'Peak CPU Usage', 'CPU (%)', 'peak_cpu')
    plot_metrics(df, 'Circuit:', 'Circuit Details', 'Count', 'circuit_details')
    plot_metrics(df, 'File Size:', 'Artifact File Sizes', 'Size', 'artifact_sizes')
    
    print("\nAll plots generated successfully!")

if __name__ == "__main__":
    if not os.path.exists('results'):
        os.makedirs('results')

    main()

