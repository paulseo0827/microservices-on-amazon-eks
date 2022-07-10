import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import * as cdk from 'aws-cdk-lib';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as eks from 'aws-cdk-lib/aws-eks';
import * as codebuild from 'aws-cdk-lib/aws-codebuild';
import * as codecommit from 'aws-cdk-lib/aws-codecommit';
import * as targets from 'aws-cdk-lib/aws-events-targets';

export class MicroservicesCdkStack extends cdk.Stack {
  constructor(scope: cdk.App, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const eksClusterName = 'eks-blueprint'
    const applicationNamespace = 'microservice'
    const eksClusterArn = 'arn:aws:eks:ap-northeast-2:687226226273:cluster/eks-blueprint'
/*
    const cluster = eks.Cluster.fromClusterAttributes(this, 'EKSCluster', {
	    clusterName: 'eks-blueprint',
	    kubectlRoleArn: 'arn:aws:iam::687226226273:role/eks-blueprint-admin-access',
    });
*/
    var applicationList:string[];
    applicationList = ['adservice','cartservice','checkoutservice','currencyservice',
                        'emailservice','frontend','paymentservice','productcatalogservice',
                        'recommendationservice','shippingservice']

    for (let index = 0; index < applicationList.length; index++) {
      const applicationName = applicationList[index];

      const ecrRepository = new ecr.Repository(this, `${applicationName}ECRRepository`, {
        repositoryName: `${applicationName}`
      });
  
      const codecommitRepository = new codecommit.Repository(this, `${applicationName}CodecommitRepository`, {
        repositoryName: `${applicationName}-repo`
      })

      const codebuildProject = new codebuild.Project(this, `${applicationName}CodebuildProject`, {
        projectName: `${applicationName}-build`,
        source: codebuild.Source.codeCommit({ repository: codecommitRepository }),
        environment: {
          buildImage: codebuild.LinuxBuildImage.STANDARD_3_0,
          privileged: true
        },
        environmentVariables: {
          'CLUSTER_NAME': {
            value: `${eksClusterName}`
          },
          'ECR_REPO_URI': {
            value: `${ecrRepository.repositoryUri}`
          }
        },
        buildSpec: codebuild.BuildSpec.fromObject({
          version: "0.2",
          phases: {
            pre_build: {
              commands: [
                'env',
                'export TAG=${CODEBUILD_RESOLVED_SOURCE_VERSION}',
                "wget -O /usr/local/bin/kubectl https://amazon-eks.s3.us-west-2.amazonaws.com/1.21.2/2021-07-05/bin/linux/amd64/kubectl",
                "chmod +x /usr/local/bin/kubectl"
              ]
            },
            build: {
              commands: [
                `docker build -t $ECR_REPO_URI:$TAG .`,
                `docker build -t $ECR_REPO_URI:latest .`,
                '$(aws ecr get-login --no-include-email)',
                'docker push $ECR_REPO_URI:$TAG',
                'docker push $ECR_REPO_URI:latest'
              ]
            },
            post_build: {
              commands: [
                "aws eks update-kubeconfig --name eks-blueprint --verbose",
                'kubectl get no',
                `sed s%IMAGE_TAG_PLACEHOLDER%$ECR_REPO_URI:$TAG% k8s/${applicationName}.yaml | kubectl -n ${applicationNamespace} apply -f - --record`
              ]
            }
          }
        })
      })
  
      codecommitRepository.onCommit('OnCommit', {
        target: new targets.CodeBuildProject(codebuild.Project.fromProjectArn(this, `${applicationName}OnCommitEvent`, codebuildProject.projectArn))
      });
  
      ecrRepository.grantPullPush(codebuildProject.role!)
      //cluster.awsAuth.addMastersRole(codebuildProject.role!)
      //importedCluster.awsAuth.addMastersRole(codebuildProject.role!);

      codebuildProject.addToRolePolicy(new iam.PolicyStatement({
        actions: ['eks:DescribeCluster'],
        resources: [`${eksClusterArn}`],
      }))

      //console.log("environment variables " + JSON.stringify(process.env));
    }
  }
}
